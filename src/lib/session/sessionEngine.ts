import type { FocusState } from "@/lib/detection/types";
import type {
  SessionConfig,
  SessionPhase,
  SessionSnapshot,
  SessionSummary,
} from "./types";

/**
 * 집중 세션 상태 머신 + 시간 집계 (C-1, C-2, C-4).
 *
 * DetectionEngine과 같은 원칙의 순수 로직 — 시간은 호출부가 넣어주는
 * timestamp로만 흐른다. update(ts, focusState)를 주기적으로 호출하면
 * 직전 호출과의 시간 차이(delta)를 당시 상태의 버킷에 누적한다.
 *
 * 집계 규칙:
 * - focused/initializing → focusedMs (세션 초반 얼굴 인식 전 워밍업은
 *   사용자 잘못이 아니므로 집중으로 인정)
 * - away/head_down → distractedMs
 * - 일시정지 중 → pausedMs (elapsed에서 제외)
 * - away/head_down 진입 횟수를 각각 카운트 (리포트용)
 */
export class SessionEngine {
  private readonly config: SessionConfig;
  private phase: SessionPhase = "idle";
  private startedAt = 0;
  private lastTickTs = 0;
  private lastFocusState: FocusState = "initializing";
  private focusedMs = 0;
  private distractedMs = 0;
  private pausedMs = 0;
  private awayCount = 0;
  private headDownCount = 0;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { goalDurationMs: null, ...config };
  }

  get currentPhase(): SessionPhase {
    return this.phase;
  }

  start(ts: number): void {
    if (this.phase !== "idle") return;
    this.phase = "running";
    this.startedAt = ts;
    this.lastTickTs = ts;
    this.lastFocusState = "initializing";
  }

  pause(ts: number): void {
    if (this.phase !== "running") return;
    this.accumulate(ts);
    this.phase = "paused";
  }

  resume(ts: number): void {
    if (this.phase !== "paused") return;
    this.accumulate(ts);
    this.phase = "running";
  }

  /**
   * 주기 호출(200ms 권장). running 중엔 delta를 집중/이탈 버킷에,
   * paused 중엔 pausedMs에 누적하고 상태 전이 횟수를 센다.
   */
  update(ts: number, focusState: FocusState): void {
    if (this.phase !== "running" && this.phase !== "paused") return;
    this.accumulate(ts);

    if (this.phase === "running" && focusState !== this.lastFocusState) {
      if (focusState === "away") this.awayCount += 1;
      if (focusState === "head_down") this.headDownCount += 1;
    }
    this.lastFocusState = focusState;
  }

  end(ts: number): SessionSummary {
    if (this.phase === "running" || this.phase === "paused") {
      this.accumulate(ts);
    }
    this.phase = "ended";
    const elapsedMs = this.focusedMs + this.distractedMs;
    return {
      startedAt: this.startedAt,
      endedAt: ts,
      goalDurationMs: this.config.goalDurationMs,
      goalReached: this.isGoalReached(elapsedMs),
      elapsedMs,
      focusedMs: this.focusedMs,
      distractedMs: this.distractedMs,
      pausedMs: this.pausedMs,
      awayCount: this.awayCount,
      headDownCount: this.headDownCount,
      focusRatio: elapsedMs > 0 ? this.focusedMs / elapsedMs : 0,
    };
  }

  getSnapshot(): SessionSnapshot {
    const elapsedMs = this.focusedMs + this.distractedMs;
    const goal = this.config.goalDurationMs;
    return {
      phase: this.phase,
      elapsedMs,
      remainingMs: goal !== null ? Math.max(0, goal - elapsedMs) : null,
      goalReached: this.isGoalReached(elapsedMs),
      focusedMs: this.focusedMs,
      distractedMs: this.distractedMs,
      pausedMs: this.pausedMs,
      awayCount: this.awayCount,
      headDownCount: this.headDownCount,
      lastFocusState: this.lastFocusState,
    };
  }

  /** 직전 tick 이후의 시간을 현재 국면/상태 버킷에 반영 */
  private accumulate(ts: number): void {
    const delta = Math.max(0, ts - this.lastTickTs);
    this.lastTickTs = ts;
    if (delta === 0) return;

    if (this.phase === "paused") {
      this.pausedMs += delta;
      return;
    }
    // running: 직전 구간의 상태(lastFocusState) 기준으로 귀속
    if (this.lastFocusState === "away" || this.lastFocusState === "head_down") {
      this.distractedMs += delta;
    } else {
      this.focusedMs += delta;
    }
  }

  private isGoalReached(elapsedMs: number): boolean {
    const goal = this.config.goalDurationMs;
    return goal !== null && elapsedMs >= goal;
  }
}
