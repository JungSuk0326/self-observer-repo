import type { HeadPose } from "@/lib/vision/types";

/**
 * 캘리브레이션 (B-2): 사용자가 정면을 바라보는 동안 머리 자세를 샘플링해
 * 개인 기준 자세(baseline)를 구한다. 카메라 각도·앉은 자세가 사람마다 달라
 * 절대각 기준으로는 오탐이 나기 때문 (아키텍처 원칙 4의 연장).
 *
 * 순수 로직 — 샘플은 호출부가 넣는다 (얼굴이 검출된 프레임만 넣을 것).
 * 이상치(순간 고개 돌림)에 강하도록 평균이 아니라 중앙값을 쓴다.
 */
export class Calibrator {
  private samples: HeadPose[] = [];

  constructor(private readonly requiredSamples = 15) {}

  /** 샘플 추가 후 진행률(0~1) 반환. 완료 후 추가는 무시된다. */
  addSample(pose: HeadPose): number {
    if (!this.isComplete) {
      this.samples.push({ ...pose });
    }
    return this.progress;
  }

  get progress(): number {
    return Math.min(1, this.samples.length / this.requiredSamples);
  }

  get isComplete(): boolean {
    return this.samples.length >= this.requiredSamples;
  }

  /** 축별 중앙값 baseline. 완료 전이면 null */
  getBaseline(): HeadPose | null {
    if (!this.isComplete) return null;
    return {
      pitch: median(this.samples.map((s) => s.pitch)),
      yaw: median(this.samples.map((s) => s.yaw)),
      roll: median(this.samples.map((s) => s.roll)),
    };
  }

  reset(): void {
    this.samples = [];
  }
}

/** 감지 입력 직전에 적용: 개인 기준 자세를 0점으로 보정 */
export function applyBaseline(pose: HeadPose, baseline: HeadPose | null): HeadPose {
  if (!baseline) return pose;
  return {
    pitch: pose.pitch - baseline.pitch,
    yaw: pose.yaw - baseline.yaw,
    roll: pose.roll - baseline.roll,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
