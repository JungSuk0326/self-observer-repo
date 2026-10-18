import { describe, expect, it } from "vitest";
import { evaluateSession, gradeFor, pickGreeting, recentDays, streakDays, toRecord } from "./stats";
import type { SessionRecord } from "./types";

const MIN = 60_000;
/** 로컬 시각으로 2026-10-d h시 */
const at = (d: number, h = 20) => new Date(2026, 9, d, h).getTime();

let seq = 0;
function rec(endedDay: number, focusMin: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  const focusedMs = focusMin * MIN;
  return {
    id: `r${seq++}`,
    startedAtWall: at(endedDay) - focusedMs,
    endedAtWall: at(endedDay),
    personaId: "mentor",
    avatarId: "study",
    goalDurationMs: null,
    goalReached: false,
    elapsedMs: focusedMs,
    focusedMs,
    distractedMs: 0,
    pausedMs: 0,
    awayCount: 0,
    headDownCount: 0,
    lookAwayCount: 0,
    longestFocusMs: focusedMs,
    focusRatio: 1,
    ...extra,
  };
}

describe("toRecord", () => {
  it("엔진 시각(performance.now)을 벽시계로 옮긴다", () => {
    const r = toRecord(
      {
        startedAt: 1000, endedAt: 1000 + 30 * MIN, goalDurationMs: null, goalReached: false,
        elapsedMs: 30 * MIN, focusedMs: 25 * MIN, distractedMs: 5 * MIN, pausedMs: 0,
        awayCount: 1, headDownCount: 0, lookAwayCount: 2, longestFocusMs: 20 * MIN, focusRatio: 25 / 30,
      },
      at(10),
      { id: "x", personaId: "cat", avatarId: "study" },
    );
    expect(r.endedAtWall).toBe(at(10));
    expect(r.startedAtWall).toBe(at(10) - 30 * MIN);
    expect(r.lookAwayCount).toBe(2);
  });
});

describe("등급", () => {
  it("5분 미만은 등급 없음, 이후 집중률로 S/A/B/C", () => {
    expect(gradeFor({ elapsedMs: 4 * MIN, focusRatio: 1 })).toBeNull();
    expect(gradeFor({ elapsedMs: 30 * MIN, focusRatio: 0.95 })).toBe("S");
    expect(gradeFor({ elapsedMs: 30 * MIN, focusRatio: 0.85 })).toBe("A");
    expect(gradeFor({ elapsedMs: 30 * MIN, focusRatio: 0.7 })).toBe("B");
    expect(gradeFor({ elapsedMs: 30 * MIN, focusRatio: 0.5 })).toBe("C");
  });
});

describe("연속 출석", () => {
  it("오늘까지 이어진 날을 센다", () => {
    expect(streakDays([rec(8, 10), rec(9, 10), rec(10, 10)], at(10, 22))).toBe(3);
  });
  it("오늘 아직 안 했어도 어제까지 이어졌으면 살아 있다", () => {
    expect(streakDays([rec(8, 10), rec(9, 10)], at(10, 9))).toBe(2);
  });
  it("하루라도 비면 끊긴다", () => {
    expect(streakDays([rec(6, 10), rec(8, 10)], at(9, 9))).toBe(1);
    expect(streakDays([rec(5, 10)], at(9, 9))).toBe(0);
  });
});

describe("세션 평가", () => {
  it("첫 세션은 최고 기록 배지 없이 첫 기록으로 표시", () => {
    const e = evaluateSession(rec(10, 30), []);
    expect(e.isFirstSession).toBe(true);
    expect(e.newBests).toEqual([]);
    expect(e.streakDays).toBe(1);
  });

  it("세션 집중·연속 집중·일일 합계 최고 기록을 각각 판정한다", () => {
    const prev = [rec(8, 40, { longestFocusMs: 30 * MIN }), rec(9, 20)];
    const cur = rec(10, 50, { longestFocusMs: 25 * MIN });
    const e = evaluateSession(cur, prev);
    expect(e.newBests).toContain("session_focus");
    expect(e.newBests).not.toContain("focus_run");
    expect(e.newBests).toContain("day_total");
  });

  it("오늘 누적과 어제 누적을 비교 재료로 준다", () => {
    const prev = [rec(9, 30), rec(10, 20)];
    const e = evaluateSession(rec(10, 15), prev);
    expect(e.todayFocusMs).toBe(35 * MIN);
    expect(e.yesterdayFocusMs).toBe(30 * MIN);
    expect(e.streakDays).toBe(2);
  });
});

describe("기억하는 감독관 인사", () => {
  it("기록이 없으면 첫 인사", () => {
    expect(pickGreeting([], at(10)).kind).toBe("first");
  });
  it("오늘 이미 했으면 오늘 누적을 말한다", () => {
    expect(pickGreeting([rec(10, 42)], at(10, 22))).toEqual({ kind: "again_today", vars: { minutes: 42 } });
  });
  it("2일 이상 연속이면 오늘 하면 될 일수를 말한다", () => {
    expect(pickGreeting([rec(8, 10), rec(9, 10)], at(10, 9))).toEqual({ kind: "streak", vars: { days: 3 } });
  });
  it("어제만 했으면 어제 기록을 말한다", () => {
    expect(pickGreeting([rec(9, 47)], at(10, 9))).toEqual({ kind: "yesterday", vars: { minutes: 47 } });
  });
  it("3일 이상 비었으면 오랜만 인사", () => {
    expect(pickGreeting([rec(3, 10)], at(10, 9))).toEqual({ kind: "long_gap", vars: { days: 7 } });
  });
});

describe("최근 날짜별 집중", () => {
  it("빈 날은 0으로 채워 오래된 날부터 준다", () => {
    const d = recentDays([rec(8, 10), rec(10, 20), rec(10, 5)], at(10, 22), 3);
    expect(d.map((x) => x.focusMs / MIN)).toEqual([10, 0, 25]);
    expect(d[2].isToday).toBe(true);
  });
});
