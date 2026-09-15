import type { MessageConfig, MessageInput, MessageKind, MessageTone, SupervisorMessage } from "./types";
import { DEFAULT_MESSAGE_CONFIG } from "./types";
import { MESSAGE_TEMPLATES, fillTemplate } from "./messages";
import type { SessionPhase } from "@/lib/session/types";

const TONE: Record<MessageKind, MessageTone> = {
  session_start: "info",
  session_resume: "info",
  away: "warn",
  away_long: "warn",
  welcome_back: "encourage",
  head_down: "warn",
  head_up: "encourage",
  focus_milestone: "encourage",
  goal_reached: "encourage",
};

/**
 * 규칙기반 감독관 메시지 엔진 (D-5).
 *
 * DetectionEngine/SessionEngine과 같은 순수 로직 — 시간은 입력 timestamp로만
 * 흐르고, 문구 선택은 결정적(랜덤 없음)이라 테스트 가능하다.
 *
 * 억제 규칙(잦은 알림은 오탐과 같은 이탈 요인):
 * - 경고(away/head_down)는 종류별 쿨다운 안에서는 재발해도 말하지 않는다.
 *   단 발생 횟수는 세어 다음 문구 단계(escalation)에 반영한다.
 * - 복귀 격려(welcome_back/head_up)는 실제로 경고가 나갔던 이탈에만 낸다.
 *   짧게 들락날락한 경우엔 조용히 넘어간다.
 * - 장시간 부재 제안은 부재 1회당 최대 1번.
 * - 집중 이정표는 누적 집중 시간이 간격을 넘을 때마다 1번, 목표 달성은 세션당 1번.
 * - 세션 밖(session === null)에서는 어떤 메시지도 내지 않는다.
 */
export class MessageEngine {
  private readonly config: MessageConfig;

  private lastPhase: SessionPhase | null = null;
  private lastWarnAt: Partial<Record<MessageKind, number>> = {};
  private warnCount: Partial<Record<MessageKind, number>> = {};
  private encourageIdx: Partial<Record<MessageKind, number>> = {};

  private awaySince: number | null = null;
  private awayWarned = false;
  private longAbsenceSaid = false;
  private headDownWarned = false;

  private lastMilestone = 0;
  private goalSaid = false;

  constructor(config: Partial<MessageConfig> = {}) {
    this.config = { ...DEFAULT_MESSAGE_CONFIG, ...config };
  }

  update(input: MessageInput): SupervisorMessage[] {
    const { timestamp, events, session } = input;
    const out: SupervisorMessage[] = [];

    if (!session) {
      this.lastPhase = null;
      return out;
    }

    // 세션 국면 전이
    const phase = session.phase;
    if (phase === "running" && this.lastPhase !== "running") {
      if (this.lastPhase === null || this.lastPhase === "idle") {
        this.resetSessionState();
        out.push(this.encourage("session_start", timestamp));
      } else if (this.lastPhase === "paused") {
        out.push(this.encourage("session_resume", timestamp));
      }
    }
    this.lastPhase = phase;

    // 세션이 진행 중일 때만 감지/격려 메시지를 낸다
    if (phase !== "running") return out;

    for (const ev of events) {
      switch (ev.type) {
        case "absence_start": {
          this.awaySince = ev.at;
          this.longAbsenceSaid = false;
          const msg = this.warn("away", ev.at);
          this.awayWarned = msg !== null;
          if (msg) out.push(msg);
          break;
        }
        case "absence_end": {
          this.awaySince = null;
          if (this.awayWarned) out.push(this.encourage("welcome_back", ev.at));
          this.awayWarned = false;
          break;
        }
        case "head_down_start": {
          const msg = this.warn("head_down", ev.at);
          this.headDownWarned = msg !== null;
          if (msg) out.push(msg);
          break;
        }
        case "head_down_end": {
          if (this.headDownWarned) out.push(this.encourage("head_up", ev.at));
          this.headDownWarned = false;
          break;
        }
      }
    }

    // 장시간 부재 — 부재 1회당 1번
    if (
      this.awaySince !== null &&
      !this.longAbsenceSaid &&
      timestamp - this.awaySince >= this.config.longAbsenceMs
    ) {
      this.longAbsenceSaid = true;
      out.push(this.make("away_long", timestamp, MESSAGE_TEMPLATES.away_long[0]));
    }

    // 목표 달성 — 세션당 1번, 같은 tick의 이정표보다 우선
    let goalJustSaid = false;
    if (session.goalReached && !this.goalSaid) {
      this.goalSaid = true;
      goalJustSaid = true;
      out.push(this.make("goal_reached", timestamp, MESSAGE_TEMPLATES.goal_reached[0]));
    }

    // 집중 이정표 — 간격을 새로 넘길 때 1번 (이탈 중엔 내지 않음)
    const interval = this.config.milestoneIntervalMs;
    const milestone = Math.floor(session.focusedMs / interval) * interval;
    if (
      milestone > this.lastMilestone &&
      session.lastFocusState !== "away" &&
      session.lastFocusState !== "head_down"
    ) {
      this.lastMilestone = milestone;
      if (!goalJustSaid) {
        out.push(
          this.encourage("focus_milestone", timestamp, {
            minutes: Math.round(milestone / 60_000),
          }),
        );
      }
    }

    return out;
  }

  reset(): void {
    this.lastPhase = null;
    this.resetSessionState();
  }

  private resetSessionState(): void {
    this.lastWarnAt = {};
    this.warnCount = {};
    this.encourageIdx = {};
    this.awaySince = null;
    this.awayWarned = false;
    this.longAbsenceSaid = false;
    this.headDownWarned = false;
    this.lastMilestone = 0;
    this.goalSaid = false;
  }

  /** 경고: 횟수는 항상 세고, 쿨다운 안이면 null */
  private warn(kind: "away" | "head_down", at: number): SupervisorMessage | null {
    const count = (this.warnCount[kind] ?? 0) + 1;
    this.warnCount[kind] = count;

    const last = this.lastWarnAt[kind];
    if (last !== undefined && at - last < this.config.warnCooldownMs) return null;
    this.lastWarnAt[kind] = at;

    const templates = MESSAGE_TEMPLATES[kind];
    const level = Math.min(count - 1, templates.length - 1);
    return this.make(kind, at, templates[level]);
  }

  /** 격려/안내: 문구를 순서대로 돌려 쓴다 */
  private encourage(
    kind: MessageKind,
    at: number,
    vars: Record<string, string | number> = {},
  ): SupervisorMessage {
    const templates = MESSAGE_TEMPLATES[kind];
    const idx = this.encourageIdx[kind] ?? 0;
    this.encourageIdx[kind] = (idx + 1) % templates.length;
    return this.make(kind, at, fillTemplate(templates[idx], vars));
  }

  private make(kind: MessageKind, at: number, text: string): SupervisorMessage {
    return { kind, tone: TONE[kind], text, at };
  }
}
