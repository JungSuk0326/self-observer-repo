"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { assetUrl } from "@/lib/assetUrl";
import type { AvatarAnchor } from "@/components/Avatar";
import { PoseHold, type Pose } from "@/lib/avatar/poseHold";
import type { FocusState } from "@/lib/detection/types";
import type { FaceSignal } from "@/lib/vision/types";

/** 렌더 픽셀 수 제한 — GPU/발열 절감 (스파이크 검증값) */
const MAX_DPR = 1.5;
/** 렌더 주기 상한. 추론이 10Hz라 30fps면 충분하고 발열이 크게 준다 */
const RENDER_INTERVAL_MS = 1000 / 30;
/** 머리 회전을 머리/목/가슴에 나누는 비율 — 큰 회전에서 옆모습이 되게 */
const HEAD_SHARE = { x: 0.6, y: 0.6, z: 0.7 };
const NECK_SHARE = { x: 0.3, y: 0.25, z: 0.3 };
const CHEST_SHARE = { x: 0.1, y: 0.15, z: 0 };
const D2R = Math.PI / 180;
/** 카메라와 얼굴의 수직 오프셋(m). upper는 얼굴을 화면 위쪽 1/3에 둔다 */
const ANCHOR_OFFSET_Y: Record<AvatarAnchor, number> = { center: 0.06, upper: -0.06 };
const CAMERA_DISTANCE = 0.95;

interface VrmAvatarProps {
  /** useFaceTracking의 signalRef — rAF로 직접 읽어 리렌더 없이 그린다 */
  signalRef: React.RefObject<FaceSignal | null>;
  /** public/ 기준 VRM 경로 */
  path: string;
  /** 감지 엔진 상태 — 얼굴을 놓쳤을 때 무엇을 그릴지 (PoseHold 참고) */
  focusState?: FocusState;
  anchor?: AvatarAnchor;
  className?: string;
}

type LoadStatus = "loading" | "ready" | "error";

/**
 * FaceSignal → VRM 3D 아바타 (B-1, 3D).
 *
 * 원본 영상은 절대 그리지 않는다 (마스킹 원칙). 머리 자세는 뼈 회전으로,
 * 깜빡임·입·미소는 VRM 표정 프리셋으로 보낸다. 얼굴을 놓친 동안은 PoseHold가
 * 정한 추정 자세를 그린다 (2D 캔버스와 같은 규칙).
 *
 * 거울 규칙: 사용자가 왼쪽을 보면 화면 속 아바타도 화면 왼쪽을 본다.
 * 그래서 yaw/roll 부호를 뒤집고 눈 좌우도 바꾼다.
 */
export default function VrmAvatar({
  signalRef,
  path,
  focusState,
  anchor = "center",
  className,
}: VrmAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusRef = useRef<FocusState | undefined>(focusState);
  const anchorRef = useRef<AvatarAnchor>(anchor);
  /** 로딩 후 결정되는 머리 위치 — anchor가 바뀌면 카메라만 다시 잡는다 */
  const frameRef = useRef<((anchor: AvatarAnchor) => void) | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    focusRef.current = focusState;
  }, [focusState]);
  useEffect(() => {
    anchorRef.current = anchor;
    frameRef.current?.(anchor);
  }, [anchor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let rafId = 0;
    let vrm: VRM | null = null;

    setStatus("loading");
    setProgress(0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171a21);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(0.5, 1, 1.5).normalize();
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.6));

    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const hold = new PoseHold();
    const clock = new THREE.Clock();
    let lastRenderTs = 0;
    let head: THREE.Object3D | null = null;
    let neck: THREE.Object3D | null = null;
    let chest: THREE.Object3D | null = null;

    const drive = (s: Pose) => {
      if (!vrm) return;
      const rx = s.pitch * D2R;
      const ry = -s.yaw * D2R; // 거울
      const rz = -s.roll * D2R;
      head?.rotation.set(rx * HEAD_SHARE.x, ry * HEAD_SHARE.y, rz * HEAD_SHARE.z);
      neck?.rotation.set(rx * NECK_SHARE.x, ry * NECK_SHARE.y, rz * NECK_SHARE.z);
      chest?.rotation.set(rx * CHEST_SHARE.x, ry * CHEST_SHARE.y, rz * CHEST_SHARE.z);
      const em = vrm.expressionManager;
      if (em) {
        em.setValue("blinkLeft", s.blinkR); // 거울: 내 오른눈 = 화면 왼쪽 눈
        em.setValue("blinkRight", s.blinkL);
        em.setValue("aa", s.jaw);
        em.setValue("happy", s.smile * 0.8);
      }
    };

    const loop = (ts: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      if (!vrm || ts - lastRenderTs < RENDER_INTERVAL_MS) return;
      lastRenderTs = ts;

      const signal = signalRef.current;
      const pose = signal?.present ? hold.observe(signal.smoothed) : hold.estimate(focusRef.current);
      // 빈 자리(null)면 중립 자세로 서서히 — 3D에서는 캐릭터를 없애는 것보다 자연스럽다
      drive(pose ?? hold.estimate("focused") ?? NEUTRAL);
      vrm.update(clock.getDelta());
      renderer.render(scene, camera);
    };

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      assetUrl(path),
      (gltf) => {
        if (disposed) return;
        vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        vrm.scene.traverse((o) => {
          o.frustumCulled = false; // 스킨드 메시는 바운딩이 어긋나 근접 촬영에서 사라질 수 있다
        });
        scene.add(vrm.scene);

        head = vrm.humanoid.getNormalizedBoneNode("head");
        neck = vrm.humanoid.getNormalizedBoneNode("neck");
        chest =
          vrm.humanoid.getNormalizedBoneNode("upperChest") ??
          vrm.humanoid.getNormalizedBoneNode("spine");

        // 머리 전체 + 어깨가 들어오는 정면 근접 구도. VRM 1.0은 +Z가 정면
        vrm.scene.updateMatrixWorld(true);
        const headPos = new THREE.Vector3();
        (head ?? vrm.scene).getWorldPosition(headPos);
        frameRef.current = (a) => {
          // 카메라를 내리고 수평으로 보면 얼굴이 화면 위쪽으로 올라간다
          const y = headPos.y + ANCHOR_OFFSET_Y[a];
          camera.position.set(headPos.x, y, headPos.z + CAMERA_DISTANCE);
          camera.lookAt(headPos.x, y, headPos.z);
        };
        frameRef.current(anchorRef.current);

        setStatus("ready");
        clock.start();
        rafId = requestAnimationFrame(loop);
      },
      (ev) => {
        if (ev.total) setProgress(ev.loaded / ev.total);
      },
      (err) => {
        if (disposed) return;
        console.error("VRM 로딩 실패", err);
        setStatus("error");
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      frameRef.current = null;
      if (vrm) {
        scene.remove(vrm.scene);
        VRMUtils.deepDispose(vrm.scene);
      }
      renderer.dispose();
    };
  }, [path, signalRef]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#171a21] text-sm text-gray-400">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          아바타 불러오는 중… {Math.round(progress * 100)}%
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#171a21] p-6 text-center text-sm text-gray-400">
          3D 아바타를 불러오지 못했습니다. 아바타 변경에서 다른 캐릭터를 골라 주세요.
        </div>
      )}
    </div>
  );
}

const NEUTRAL: Pose = {
  pitch: 0, yaw: 0, roll: 0, blinkL: 0, blinkR: 0, jaw: 0, brow: 0, smile: 0,
};
