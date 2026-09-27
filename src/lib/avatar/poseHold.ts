import type { FocusState } from "@/lib/detection/types";
import type { Expression, HeadPose } from "@/lib/vision/types";

export type Pose = HeadPose & Expression;

/** 시선 이탈로 판정됐을 때 보여줄 측면 각도 — 추적 한계(±45°) 너머는 추정이다 */
export const TURNED_YAW_DEG = 80;
/** 추정 자세로 넘어가는 프레임당 보간 계수 */
const EASE = 0.12;

export const NEUTRAL_POSE: Pose = {
  pitch: 0, yaw: 0, roll: 0, blinkL: 0, blinkR: 0, jaw: 0, brow: 0, smile: 0,
};

/**
 * 얼굴을 놓친 동안 아바타가 취할 자세를 정한다 (2D·3D 렌더러 공용).
 *
 * 얼굴 모델은 정면 ±45° 근처에서 추적이 끊긴다. 놓친 순간 아바타를 정면으로
 * 튕겨 보내면 "정면만 된다"처럼 보이므로, 감지 엔진의 판정에 따라:
 * - looking_away → 마지막으로 본 방향으로 더 돌린 옆모습(추정)
 * - away → null (빈 자리로 그린다)
 * - 그 외(잠깐 놓침) → 마지막 자세를 유지하며 표정만 푼다
 */
export class PoseHold {
  private held: Pose | null = null;

  /** 얼굴이 보이는 프레임의 자세를 기억한다 */
  observe(pose: Pose): Pose {
    this.held = { ...pose };
    return pose;
  }

  /** 얼굴이 안 보이는 프레임에 그릴 자세. null이면 빈 자리 */
  estimate(state: FocusState | undefined): Pose | null {
    const held = this.held;
    if (!held || state === undefined || state === "away") return null;
    const target: Pose = {
      ...NEUTRAL_POSE,
      pitch: held.pitch,
      yaw: state === "looking_away" ? Math.sign(held.yaw || 1) * TURNED_YAW_DEG : held.yaw,
    };
    for (const k of Object.keys(held) as (keyof Pose)[]) {
      held[k] += (target[k] - held[k]) * EASE;
    }
    return held;
  }

  reset(): void {
    this.held = null;
  }
}
