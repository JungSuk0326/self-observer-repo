import { describe, expect, it } from "vitest";
import { MessageEngine } from "./messageEngine";
import type { MessageInput } from "./types";
import type { DetectionEvent, FocusState } from "@/lib/detection/types";
import type { SessionSnapshot } from "@/lib/session/types";

function snap(over: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    phase: "running",
    elapsedMs: 0,
    remainingMs: null,
    goalReached: false,
    focusedMs: 0,
    distractedMs: 0,
    pausedMs: 0,
    awayCount: 0,
    headDownCount: 0,
    lastFocusState: "focused",
    ...over,
  };
}

function ev(type: DetectionEvent["type"], at: number): DetectionEvent {
  return { type, at };
}

function tick(
  ts: number,
  events: DetectionEvent[] = [],
  session: SessionSnapshot | null = snap(),
): MessageInput {
  return { timestamp: ts, events, session };
}

/** 세션 시작 인사를 소비한 상태의 엔진 */
function startedEngine(config?: ConstructorParameters<typeof MessageEngine>[0]) {
  const e = new MessageEngine(config);
  const first = e.update(tick(0));
  expect(first.map((m) => m.kind)).toEqual(["session_start"]);
  return e;
}

describe("MessageEngine — 세션 국면", () => {
  it("세션 밖에서는 어떤 이벤트에도 말하지 않는다", () => {
    const e = new MessageEngine();
    expect(e.update(tick(0, [ev("absence_start", 0)], null))).toEqual([]);
  });

  it("세션 시작 시 인사 1번, 이후 running 유지 중엔 반복하지 않는다", () => {
    const e = new MessageEngine();
    expect(e.update(tick(0)).map((m) => m.kind)).toEqual(["session_start"]);
    expect(e.update(tick(200))).toEqual([]);
  });

  it("휴식 후 재개하면 재개 안내를 낸다", () => {
    const e = startedEngine();
    expect(e.update(tick(1000, [], snap({ phase: "paused" })))).toEqual([]);
    expect(e.update(tick(2000)).map((m) => m.kind)).toEqual(["session_resume"]);
  });

  it("휴식 중 들어온 감지 이벤트는 무시한다", () => {
    const e = startedEngine();
    const paused = snap({ phase: "paused" });
    expect(e.update(tick(1000, [ev("absence_start", 1000)], paused))).toEqual([]);
  });
});

describe("MessageEngine — 부재 경고와 억제", () => {
  it("부재 시작에 경고, 복귀에 격려를 낸다", () => {
    const e = startedEngine();
    const warn = e.update(tick(5000, [ev("absence_start", 5000)]));
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ kind: "away", tone: "warn" });

    const back = e.update(tick(20_000, [ev("absence_end", 20_000)]));
    expect(back.map((m) => m.kind)).toEqual(["welcome_back"]);
  });

  it("쿨다운 안의 재발은 경고하지 않고, 복귀 격려도 내지 않는다", () => {
    const e = startedEngine({ warnCooldownMs: 45_000 });
    e.update(tick(5000, [ev("absence_start", 5000)]));
    e.update(tick(10_000, [ev("absence_end", 10_000)]));

    // 20초 뒤 다시 부재 — 쿨다운 안
    expect(e.update(tick(30_000, [ev("absence_start", 30_000)]))).toEqual([]);
    expect(e.update(tick(35_000, [ev("absence_end", 35_000)]))).toEqual([]);
  });

  it("쿨다운이 지나면 다시 경고하고, 문구는 단계가 올라간다", () => {
    const e = startedEngine({ warnCooldownMs: 45_000 });
    const first = e.update(tick(5000, [ev("absence_start", 5000)]))[0];
    e.update(tick(10_000, [ev("absence_end", 10_000)]));

    const second = e.update(tick(60_000, [ev("absence_start", 60_000)]))[0];
    expect(second.kind).toBe("away");
    expect(second.text).not.toBe(first.text);
  });

  it("쿨다운 안에 억제된 발생도 횟수에는 반영되어 단계가 건너뛴다", () => {
    const e = startedEngine({ warnCooldownMs: 45_000 });
    const first = e.update(tick(5000, [ev("absence_start", 5000)]))[0];
    e.update(tick(10_000, [ev("absence_end", 10_000)]));
    e.update(tick(20_000, [ev("absence_start", 20_000)])); // 억제됨(2회째)
    e.update(tick(25_000, [ev("absence_end", 25_000)]));

    const third = e.update(tick(60_000, [ev("absence_start", 60_000)]))[0];
    expect(third.text).not.toBe(first.text);
    // 3단계 문구(마지막)여야 한다
    expect(third.text).toContain("자주");
  });

  it("장시간 부재는 1번만 제안한다", () => {
    const e = startedEngine({ longAbsenceMs: 60_000 });
    e.update(tick(5000, [ev("absence_start", 5000)]));
    expect(e.update(tick(60_000))).toEqual([]); // 55초 — 아직
    expect(e.update(tick(65_000)).map((m) => m.kind)).toEqual(["away_long"]);
    expect(e.update(tick(120_000))).toEqual([]); // 반복 없음
  });
});

describe("MessageEngine — 고개 숙임", () => {
  it("고개 숙임 시작에 경고, 해소에 격려를 낸다", () => {
    const e = startedEngine();
    expect(
      e.update(tick(5000, [ev("head_down_start", 5000)])).map((m) => m.kind),
    ).toEqual(["head_down"]);
    expect(
      e.update(tick(9000, [ev("head_down_end", 9000)])).map((m) => m.kind),
    ).toEqual(["head_up"]);
  });

  it("부재와 고개 숙임 쿨다운은 서로 독립이다", () => {
    const e = startedEngine({ warnCooldownMs: 45_000 });
    e.update(tick(5000, [ev("absence_start", 5000)]));
    e.update(tick(8000, [ev("absence_end", 8000)]));
    const hd = e.update(tick(10_000, [ev("head_down_start", 10_000)]));
    expect(hd.map((m) => m.kind)).toEqual(["head_down"]);
  });
});

describe("MessageEngine — 격려", () => {
  it("누적 집중 시간이 간격을 넘을 때마다 이정표를 1번 낸다", () => {
    const e = startedEngine({ milestoneIntervalMs: 60_000 });
    expect(e.update(tick(30_000, [], snap({ focusedMs: 30_000 })))).toEqual([]);
    const m1 = e.update(tick(60_000, [], snap({ focusedMs: 60_000 })));
    expect(m1.map((m) => m.kind)).toEqual(["focus_milestone"]);
    expect(m1[0].text).toContain("1분");
    expect(e.update(tick(90_000, [], snap({ focusedMs: 90_000 })))).toEqual([]);
    const m2 = e.update(tick(120_000, [], snap({ focusedMs: 120_000 })));
    expect(m2[0].text).toContain("2분");
  });

  it("이탈 중에는 이정표를 내지 않고, 복귀 후 낸다", () => {
    const e = startedEngine({ milestoneIntervalMs: 60_000 });
    const away: FocusState = "away";
    expect(
      e.update(tick(60_000, [], snap({ focusedMs: 60_000, lastFocusState: away }))),
    ).toEqual([]);
    expect(
      e.update(tick(61_000, [], snap({ focusedMs: 60_000 }))).map((m) => m.kind),
    ).toEqual(["focus_milestone"]);
  });

  it("목표 달성은 세션당 1번, 같은 tick의 이정표는 생략한다", () => {
    const e = startedEngine({ milestoneIntervalMs: 60_000 });
    const done = snap({ focusedMs: 60_000, goalReached: true });
    expect(e.update(tick(60_000, [], done)).map((m) => m.kind)).toEqual([
      "goal_reached",
    ]);
    expect(e.update(tick(61_000, [], done))).toEqual([]);
  });

  it("새 세션이 시작되면 횟수·쿨다운·이정표가 초기화된다", () => {
    const e = startedEngine({ warnCooldownMs: 45_000 });
    const first = e.update(tick(5000, [ev("absence_start", 5000)]))[0];
    e.update(tick(8000, [], snap({ phase: "ended" })));
    e.update(tick(9000, [], null));

    expect(e.update(tick(10_000)).map((m) => m.kind)).toEqual(["session_start"]);
    const again = e.update(tick(11_000, [ev("absence_start", 11_000)]));
    expect(again).toHaveLength(1); // 쿨다운이 이어지지 않음
    expect(again[0].text).toBe(first.text); // 1단계 문구로 돌아감
  });
});
