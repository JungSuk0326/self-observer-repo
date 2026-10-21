/**
 * 저장되는 세션 한 건 (G-2). 로컬(IndexedDB)에만 저장되고 서버로 나가지 않는다.
 * 시각은 벽시계(Date.now()) 기준 — 세션 엔진의 performance.now()는 페이지마다
 * 0부터 시작하므로 날짜 계산(연속 출석)에 쓸 수 없다.
 */
export interface SessionRecord {
  id: string;
  startedAtWall: number;
  endedAtWall: number;
  personaId: string;
  avatarId: string;
  goalDurationMs: number | null;
  goalReached: boolean;
  elapsedMs: number;
  focusedMs: number;
  distractedMs: number;
  pausedMs: number;
  awayCount: number;
  headDownCount: number;
  lookAwayCount: number;
  /** 예전 기록엔 없을 수 있다 (손 감지 이전) */
  phoneCount?: number;
  longestFocusMs: number;
  focusRatio: number;
}

export type Grade = "S" | "A" | "B" | "C";

export type BestKind = "session_focus" | "focus_run" | "day_total";

/** 세션 종료 시 이전 기록과 비교한 평가 — 리포트 화면의 재료 (G-1) */
export interface SessionEvaluation {
  /** 너무 짧은 세션은 등급을 매기지 않는다 */
  grade: Grade | null;
  /** 이번 세션으로 갱신된 개인 최고 기록 (첫 세션이면 비어 있다) */
  newBests: BestKind[];
  isFirstSession: boolean;
  /** 이번 세션 포함 연속 출석 일수 */
  streakDays: number;
  /** 이번 세션 포함 오늘 누적 집중(ms) */
  todayFocusMs: number;
  /** 어제 누적 집중(ms). 어제 기록이 없으면 null */
  yesterdayFocusMs: number | null;
}

/** 다음 방문 때 감독관이 꺼낼 화제 */
export type GreetingKind = "first" | "again_today" | "streak" | "yesterday" | "long_gap";

export interface Greeting {
  kind: GreetingKind;
  vars: Record<string, number>;
}
