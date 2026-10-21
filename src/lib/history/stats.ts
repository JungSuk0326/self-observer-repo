import type { SessionSummary } from "@/lib/session/types";
import type {
  BestKind,
  Grade,
  Greeting,
  SessionEvaluation,
  SessionRecord,
} from "./types";

/** 이보다 짧은 세션은 등급을 매기지 않는다 (잠깐 켜 본 것에 C를 주면 기분만 상한다) */
export const MIN_GRADED_MS = 5 * 60_000;
/** 이 일수 이상 비면 "오랜만" 인사 */
const LONG_GAP_DAYS = 3;
const DAY_MS = 86_400_000;

/** 로컬 날짜 키 (사용자 기준 하루) */
export function dayKey(wallMs: number): string {
  const d = new Date(wallMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 로컬 자정 기준 며칠 차이 (서머타임에도 안전하게 반올림) */
function dayDiff(aWall: number, bWall: number): number {
  const a = new Date(aWall);
  const b = new Date(bWall);
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((a0 - b0) / DAY_MS);
}

export function toRecord(
  summary: SessionSummary,
  wallNow: number,
  ids: { id: string; personaId: string; avatarId: string },
): SessionRecord {
  const span = summary.endedAt - summary.startedAt;
  return {
    ...ids,
    startedAtWall: wallNow - span,
    endedAtWall: wallNow,
    goalDurationMs: summary.goalDurationMs,
    goalReached: summary.goalReached,
    elapsedMs: summary.elapsedMs,
    focusedMs: summary.focusedMs,
    distractedMs: summary.distractedMs,
    pausedMs: summary.pausedMs,
    awayCount: summary.awayCount,
    headDownCount: summary.headDownCount,
    lookAwayCount: summary.lookAwayCount,
    phoneCount: summary.phoneCount,
    longestFocusMs: summary.longestFocusMs,
    focusRatio: summary.focusRatio,
  };
}

export function gradeFor(r: Pick<SessionRecord, "elapsedMs" | "focusRatio">): Grade | null {
  if (r.elapsedMs < MIN_GRADED_MS) return null;
  if (r.focusRatio >= 0.9) return "S";
  if (r.focusRatio >= 0.8) return "A";
  if (r.focusRatio >= 0.65) return "B";
  return "C";
}

/** 날짜별 집중 합계 */
function focusByDay(records: SessionRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) m.set(dayKey(r.endedAtWall), (m.get(dayKey(r.endedAtWall)) ?? 0) + r.focusedMs);
  return m;
}

/**
 * 연속 출석 일수. 오늘 기록이 없어도 어제까지 이어졌다면 살아 있는 연속으로 센다
 * (아직 오늘 공부를 안 한 것뿐이다).
 */
export function streakDays(records: SessionRecord[], wallNow: number): number {
  const days = new Set(records.map((r) => dayKey(r.endedAtWall)));
  let cursor = days.has(dayKey(wallNow)) ? wallNow : wallNow - DAY_MS;
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    cursor -= DAY_MS;
  }
  return n;
}

/** 방금 끝난 세션(current)을 이전 기록(previous)과 비교한다 */
export function evaluateSession(
  current: SessionRecord,
  previous: SessionRecord[],
): SessionEvaluation {
  const all = [...previous, current];
  const now = current.endedAtWall;
  const byDay = focusByDay(all);
  const prevByDay = focusByDay(previous);
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);

  const newBests: BestKind[] = [];
  if (previous.length > 0) {
    const maxOf = (f: (r: SessionRecord) => number) => Math.max(...previous.map(f));
    if (current.focusedMs > maxOf((r) => r.focusedMs)) newBests.push("session_focus");
    if (current.longestFocusMs > maxOf((r) => r.longestFocusMs)) newBests.push("focus_run");
    const prevBestDay = Math.max(0, ...prevByDay.values());
    // 오늘 첫 세션이 곧 최고 일일 기록인 경우도 축하한다 (단, 실제로 넘어섰을 때만)
    if ((byDay.get(today) ?? 0) > prevBestDay && prevBestDay > 0) newBests.push("day_total");
  }

  return {
    grade: gradeFor(current),
    newBests,
    isFirstSession: previous.length === 0,
    streakDays: streakDays(all, now),
    todayFocusMs: byDay.get(today) ?? 0,
    yesterdayFocusMs: byDay.has(yesterday) ? byDay.get(yesterday)! : null,
  };
}

/**
 * 세션 시작 전 감독관이 꺼낼 화제 — "나를 기억한다"는 느낌의 핵심.
 * 우선순위: 첫 방문 > 오늘 재방문 > 연속 출석 > 오랜 공백 > 어제 기록.
 */
export function pickGreeting(records: SessionRecord[], wallNow: number): Greeting {
  if (records.length === 0) return { kind: "first", vars: {} };
  const byDay = focusByDay(records);
  const todayMs = byDay.get(dayKey(wallNow)) ?? 0;
  if (todayMs > 0) return { kind: "again_today", vars: { minutes: Math.round(todayMs / 60_000) } };

  const streak = streakDays(records, wallNow);
  if (streak >= 2) return { kind: "streak", vars: { days: streak + 1 } }; // 오늘 하면 +1일

  const last = Math.max(...records.map((r) => r.endedAtWall));
  const gap = dayDiff(wallNow, last);
  if (gap >= LONG_GAP_DAYS) return { kind: "long_gap", vars: { days: gap } };

  const yesterdayMs = byDay.get(dayKey(wallNow - DAY_MS));
  if (yesterdayMs) return { kind: "yesterday", vars: { minutes: Math.round(yesterdayMs / 60_000) } };
  return { kind: "long_gap", vars: { days: gap } };
}

/** 최근 n일 날짜별 집중(ms), 오래된 날부터 */
export function recentDays(records: SessionRecord[], wallNow: number, n: number) {
  const byDay = focusByDay(records);
  const out: { key: string; focusMs: number; isToday: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(wallNow - i * DAY_MS);
    out.push({ key, focusMs: byDay.get(key) ?? 0, isToday: i === 0 });
  }
  return out;
}
