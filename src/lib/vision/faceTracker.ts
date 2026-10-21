import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { handGeometry } from "./handGeometry";
import { matrixToEuler } from "./matrix";
import type { FaceFrameCallback, FaceSignal, TrackerStats } from "./types";

// wasm 버전은 package.json의 @mediapipe/tasks-vision 버전과 일치시킬 것
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ── 발열 절감 파라미터 (스파이크에서 iPhone 15 Pro 실기 검증) ──
/** 추론 주기. 감지 목적엔 10Hz면 충분 — 매 프레임 추론은 발열 주범 */
const INFER_INTERVAL_MS = 100;
/** 손 추론 주기. 코 파기·폰 들기는 초 단위로 지속되는 행동이라 3Hz면 충분하다 */
const HAND_INTERVAL_MS = 333;
/** 저주기 추론값을 렌더 프레임에 잇는 보간 계수 */
const SMOOTH_FACTOR = 0.35;
/** 이동 평균 윈도 크기 */
const STAT_WINDOW = 60;

/** 카메라 요청 제약 — 발열 절감을 위해 저해상도/저프레임 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 480 },
    height: { ideal: 360 },
    frameRate: { ideal: 15, max: 24 },
  },
  audio: false,
};

const BLENDSHAPE_KEYS = {
  blinkL: "eyeBlinkLeft",
  blinkR: "eyeBlinkRight",
  jaw: "jawOpen",
  brow: "browInnerUp",
} as const;

/**
 * 카메라 프레임 → FaceSignal 스트림.
 * React 비의존 순수 클래스 — 훅(useFaceTracking)이 감싸서 쓴다.
 * 모든 추론은 온디바이스(GPU delegate)로 수행된다 — 아키텍처 원칙 1.
 */
export class FaceTracker {
  private landmarker: FaceLandmarker;
  private handLandmarker: HandLandmarker | null;
  private lastHandTs = 0;
  private lastHand: ReturnType<HandLandmarker["detectForVideo"]> | null = null;
  private rafId: number | null = null;
  private lastVideoTime = -1;
  private lastInferTs = 0;
  private lastFrameTs = 0;
  private frameTimes: number[] = [];
  private inferTimes: number[] = [];
  private smoothed = {
    pitch: 0, yaw: 0, roll: 0,
    blinkL: 0, blinkR: 0, jaw: 0, brow: 0, smile: 0,
  };

  private constructor(landmarker: FaceLandmarker, handLandmarker: HandLandmarker | null) {
    this.landmarker = landmarker;
    this.handLandmarker = handLandmarker;
  }

  /**
   * 모델 로딩 포함 — 첫 호출 시 수 초 걸릴 수 있음 (진행 표시는 호출부 책임).
   * 손 모델은 실패해도 얼굴 추적은 계속한다 (손 딴짓 감지만 빠진다).
   */
  static async create(): Promise<FaceTracker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    const [landmarker, handLandmarker] = await Promise.all([
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        // 얼굴에 겹친 손(코 파기·턱 괴기)은 손바닥이 가려져 신뢰도가 낮다 — 기본 0.5에서 낮춘다
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      }).catch((e: unknown) => {
        console.warn("손 모델 로딩 실패 — 손 딴짓 감지 없이 진행", e);
        return null;
      }),
    ]);
    return new FaceTracker(landmarker, handLandmarker);
  }

  /** rAF 루프 시작. video는 재생 중인 카메라 스트림이어야 한다. */
  start(video: HTMLVideoElement, onFrame: FaceFrameCallback): void {
    if (this.rafId !== null) return;
    const loop = (ts: number) => {
      this.rafId = requestAnimationFrame(loop);
      this.tick(video, ts, onFrame);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastVideoTime = -1;
    this.lastFrameTs = 0;
    this.frameTimes = [];
    this.inferTimes = [];
  }

  /** stop 후 재사용 불가 — 모델 자원 해제 */
  close(): void {
    this.stop();
    this.landmarker.close();
    this.handLandmarker?.close();
  }

  private lastResult: ReturnType<FaceLandmarker["detectForVideo"]> | null = null;

  private tick(video: HTMLVideoElement, ts: number, onFrame: FaceFrameCallback): void {
    if (this.lastFrameTs > 0) {
      this.pushWindowed(this.frameTimes, ts - this.lastFrameTs);
    }
    this.lastFrameTs = ts;

    // 새 비디오 프레임 + 추론 주기일 때만 추론 (발열 절감 핵심)
    if (
      video.currentTime !== this.lastVideoTime &&
      video.readyState >= 2 &&
      ts - this.lastInferTs >= INFER_INTERVAL_MS
    ) {
      this.lastVideoTime = video.currentTime;
      this.lastInferTs = ts;
      const t0 = performance.now();
      this.lastResult = this.landmarker.detectForVideo(video, t0);
      // 손 추론은 더 낮은 주기로, 얼굴이 보일 때만 (부재 중엔 돌릴 이유가 없다)
      if (
        this.handLandmarker &&
        this.lastResult.faceLandmarks?.length &&
        ts - this.lastHandTs >= HAND_INTERVAL_MS
      ) {
        this.lastHandTs = ts;
        this.lastHand = this.handLandmarker.detectForVideo(video, performance.now());
      }
      this.pushWindowed(this.inferTimes, performance.now() - t0);
    }

    onFrame(this.buildSignal(ts), this.buildStats());
  }

  private buildSignal(ts: number): FaceSignal {
    const result = this.lastResult;
    const present = Boolean(result?.faceLandmarks?.length);
    const matrix = result?.facialTransformationMatrixes?.[0]?.data;
    const pose = present && matrix ? matrixToEuler(matrix) : { pitch: 0, yaw: 0, roll: 0 };

    const categories = result?.faceBlendshapes?.[0]?.categories;
    const score = (name: string) =>
      categories?.find((c) => c.categoryName === name)?.score ?? 0;

    const target = {
      ...pose,
      blinkL: score(BLENDSHAPE_KEYS.blinkL),
      blinkR: score(BLENDSHAPE_KEYS.blinkR),
      jaw: score(BLENDSHAPE_KEYS.jaw),
      brow: score(BLENDSHAPE_KEYS.brow),
      smile: (score("mouthSmileLeft") + score("mouthSmileRight")) / 2,
    };
    for (const key of Object.keys(target) as (keyof typeof target)[]) {
      this.smoothed[key] += (target[key] - this.smoothed[key]) * SMOOTH_FACTOR;
    }

    const faceLandmarks = result?.faceLandmarks?.[0];
    const hand =
      present && faceLandmarks && this.handLandmarker
        ? handGeometry(faceLandmarks, this.lastHand?.landmarks ?? [])
        : null;

    return {
      present,
      pose,
      smoothed: { ...this.smoothed },
      hand,
      handModelReady: this.handLandmarker !== null,
      timestamp: ts,
    };
  }

  private buildStats(): TrackerStats {
    return {
      fps: this.frameTimes.length ? 1000 / average(this.frameTimes) : 0,
      inferMs: average(this.inferTimes),
    };
  }

  private pushWindowed(arr: number[], value: number): void {
    arr.push(value);
    if (arr.length > STAT_WINDOW) arr.shift();
  }
}

function average(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
