import type { FocusState } from "@/lib/detection/types";

export type SessionPhase = "idle" | "running" | "paused" | "ended";

export interface SessionConfig {
  /** 목표 시간(ms). null이면 자유 모드(스톱워치) */
  goalDurationMs: number | null;
}

/** 진행 중 화면 표시용 스냅샷 */
export interface SessionSnapshot {
  phase: SessionPhase;
  /** 세션 시작 후 경과(일시정지 시간 제외) */
  elapsedMs: number;
  /** 목표까지 남은 시간. 자유 모드면 null */
  remainingMs: number | null;
  goalReached: boolean;
  focusedMs: number;
  /** 부재 + 고개숙임 합산 */
  distractedMs: number;
  pausedMs: number;
  awayCount: number;
  headDownCount: number;
  /** 마지막으로 반영된 집중 상태 */
  lastFocusState: FocusState;
}

/** 세션 종료 시 확정되는 요약 — 리포트(G-1)와 로컬 저장(G-2)의 입력 */
export interface SessionSummary {
  startedAt: number;
  endedAt: number;
  goalDurationMs: number | null;
  goalReached: boolean;
  elapsedMs: number;
  focusedMs: number;
  distractedMs: number;
  pausedMs: number;
  awayCount: number;
  headDownCount: number;
  /** 집중률(0~1). elapsed 0이면 0 */
  focusRatio: number;
}
