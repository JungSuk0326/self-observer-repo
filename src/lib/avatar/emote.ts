import type { MessageKind } from "@/lib/message/types";
import type { Pose } from "./poseHold";

/**
 * 아바타 표정 반응 — 감독관 메시지에 맞춰 짧게 감정을 얹는다.
 *
 * 마스킹 원칙(3): 아바타는 사용자의 집중 신호를 전달하는 얼굴이다. 그래서 반응은
 * 몇 초짜리 오버레이로만 쓰고 추적 값(머리 자세·깜빡임)은 그대로 둔다.
 * 이름은 VRM 1.0 표정 프리셋과 같다(2D 캔버스는 applyEmoteToPose로 흉내 낸다).
 */
export type EmoteName = "happy" | "surprised" | "sad" | "relaxed";

export interface Emote {
  name: EmoteName;
  /** performance.now() 기준 */
  startedAt: number;
  durationMs: number;
  /** 최대 세기 0~1 */
  strength: number;
}

const FADE_IN_MS = 200;
const FADE_OUT_MS = 500;

type EmoteSpec = Omit<Emote, "startedAt">;

const BY_MESSAGE: Partial<Record<MessageKind, EmoteSpec>> = {
  session_start: { name: "happy", durationMs: 1800, strength: 0.6 },
  welcome_back: { name: "happy", durationMs: 1800, strength: 0.6 },
  head_up: { name: "happy", durationMs: 1500, strength: 0.5 },
  look_back: { name: "happy", durationMs: 1500, strength: 0.5 },
  focus_milestone: { name: "happy", durationMs: 2600, strength: 0.9 },
  goal_reached: { name: "happy", durationMs: 4000, strength: 1 },
  // 딴 데 보다 들킴
  look_away: { name: "surprised", durationMs: 1800, strength: 0.8 },
  // 졸음 경고엔 나른한 표정
  head_down: { name: "relaxed", durationMs: 2200, strength: 0.7 },
  away_long: { name: "sad", durationMs: 3000, strength: 0.8 },
  // away 경고: 얼굴이 안 보이는 중이라 표정을 얹지 않는다
};

/** 이 메시지에 아바타가 반응해야 하면 표정을 돌려준다 */
export function emoteForMessage(kind: MessageKind, now: number): Emote | null {
  const spec = BY_MESSAGE[kind];
  return spec ? { ...spec, startedAt: now } : null;
}

/** 지금 이 순간의 표정 세기(0~1). 짧게 올라갔다 유지 후 천천히 빠진다 */
export function emoteWeight(emote: Emote | null, now: number): number {
  if (!emote) return 0;
  const t = now - emote.startedAt;
  if (t < 0 || t >= emote.durationMs) return 0;
  const fadeIn = Math.min(1, t / FADE_IN_MS);
  const fadeOut = Math.min(1, (emote.durationMs - t) / FADE_OUT_MS);
  return emote.strength * Math.min(fadeIn, fadeOut);
}

/** 2D 캔버스용: 표정을 자세 값으로 근사한다 (추적 값을 덮지 않고 최대값만 올린다) */
export function applyEmoteToPose(pose: Pose, name: EmoteName, w: number): Pose {
  if (w <= 0) return pose;
  const p = { ...pose };
  switch (name) {
    case "happy":
      p.smile = Math.max(p.smile, w);
      break;
    case "surprised":
      p.jaw = Math.max(p.jaw, 0.45 * w);
      p.brow = Math.max(p.brow, w);
      break;
    case "sad":
      p.brow = Math.max(p.brow, 0.6 * w);
      p.smile = p.smile * (1 - w);
      break;
    case "relaxed":
      p.blinkL = Math.max(p.blinkL, 0.55 * w);
      p.blinkR = Math.max(p.blinkR, 0.55 * w);
      break;
  }
  return p;
}
