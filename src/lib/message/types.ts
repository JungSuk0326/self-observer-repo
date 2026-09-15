import type { DetectionEvent } from "@/lib/detection/types";
import type { SessionSnapshot } from "@/lib/session/types";

/** 메시지 종류 — 규칙 엔진이 만들고 UI/음성이 소비 */
export type MessageKind =
  | "session_start" // 세션 시작 인사
  | "session_resume" // 휴식 후 재개
  | "away" // 부재 경고 (D-1)
  | "away_long" // 장시간 부재 — 휴식/종료 제안
  | "welcome_back" // 부재 후 복귀 격려
  | "head_down" // 고개 숙임 경고 (D-2)
  | "head_up" // 고개 숙임 해소 격려
  | "focus_milestone" // 누적 집중 시간 이정표 격려
  | "goal_reached"; // 목표 시간 달성

export type MessageTone = "warn" | "encourage" | "info";

export interface SupervisorMessage {
  kind: MessageKind;
  tone: MessageTone;
  text: string;
  /** 발생 시각 (입력 timestamp 기준) */
  at: number;
}

/** 엔진 입력 — 매 tick 감지 이벤트와 세션 스냅샷을 함께 넣는다 */
export interface MessageInput {
  timestamp: number;
  /** 이번 tick의 DetectionEngine 이벤트 (없으면 빈 배열) */
  events: DetectionEvent[];
  /** 세션 밖이면 null */
  session: SessionSnapshot | null;
}

/**
 * 잦은 알림 억제 파라미터 (아키텍처 원칙 4의 메시지 층 연장).
 * 감지 엔진이 오탐을 걸러도, 같은 경고가 연달아 뜨면 사용자는 떠난다.
 */
export interface MessageConfig {
  /** 같은 종류 경고의 최소 간격(ms). 그 안의 재발은 세되 말하지 않는다 */
  warnCooldownMs: number;
  /** 부재가 이 시간(ms)을 넘으면 휴식/종료 제안을 1회 낸다 */
  longAbsenceMs: number;
  /** 누적 집중 시간이 이 간격(ms)마다 이정표 격려를 낸다 */
  milestoneIntervalMs: number;
}

export const DEFAULT_MESSAGE_CONFIG: MessageConfig = {
  warnCooldownMs: 45_000,
  longAbsenceMs: 5 * 60_000,
  milestoneIntervalMs: 15 * 60_000,
};
