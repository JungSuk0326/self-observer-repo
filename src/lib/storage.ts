import type { HeadPose } from "@/lib/vision/types";

/**
 * 로컬 설정 저장 (local-first — 서버로 나가지 않는다).
 *
 * 키를 한 곳에 모으는 이유: 온보딩 페이지와 개발 검증 페이지가 같은 값을 읽고
 * 쓰기 때문에, 문자열이 흩어지면 조용히 어긋난다.
 * 시크릿 모드/저장소 차단 브라우저에선 읽기·쓰기가 예외를 던지므로 전부 감싼다.
 */
const KEYS = {
  avatar: "fg.avatarPreset",
  calibration: "fg.calibration",
  voice: "fg.voice",
  goal: "fg.goalMinutes",
} as const;

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 치명적이지 않다 — 이번 세션 동안만 유지된다
  }
}

export function loadAvatarId(): string | null {
  return readRaw(KEYS.avatar);
}

export function saveAvatarId(id: string): void {
  writeRaw(KEYS.avatar, id);
}

/** 저장된 캘리브레이션 baseline. 값이 깨져 있으면 없는 것으로 취급한다 */
export function loadCalibration(): HeadPose | null {
  const raw = readRaw(KEYS.calibration);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isHeadPose(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCalibration(baseline: HeadPose): void {
  writeRaw(KEYS.calibration, JSON.stringify(baseline));
}

export function loadVoiceEnabled(): boolean {
  return readRaw(KEYS.voice) === "1";
}

export function saveVoiceEnabled(enabled: boolean): void {
  writeRaw(KEYS.voice, enabled ? "1" : "0");
}

/** 목표 시간(분). null이면 자유 모드(스톱워치) */
export function loadGoalMinutes(): number | null {
  const raw = readRaw(KEYS.goal);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function saveGoalMinutes(minutes: number | null): void {
  writeRaw(KEYS.goal, minutes === null ? "" : String(minutes));
}

function isHeadPose(v: unknown): v is HeadPose {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.pitch === "number" &&
    typeof p.yaw === "number" &&
    typeof p.roll === "number" &&
    Number.isFinite(p.pitch) &&
    Number.isFinite(p.yaw) &&
    Number.isFinite(p.roll)
  );
}
