import { describe, expect, it } from "vitest";
import { SessionEngine } from "./sessionEngine";

describe("SessionEngine — 기본 흐름", () => {
  it("start 전에는 update가 아무것도 누적하지 않는다", () => {
    const s = new SessionEngine();
    s.update(1000, "focused");
    s.update(5000, "focused");
    expect(s.getSnapshot().elapsedMs).toBe(0);
    expect(s.currentPhase).toBe("idle");
  });

  it("집중 시간이 누적된다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(1000, "focused");
    s.update(3000, "focused");
    const snap = s.getSnapshot();
    expect(snap.elapsedMs).toBe(3000);
    expect(snap.focusedMs).toBe(3000);
    expect(snap.distractedMs).toBe(0);
  });

  it("세션 초반 initializing 구간은 집중으로 인정한다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(2000, "initializing"); // 얼굴 인식 워밍업
    s.update(4000, "focused");
    expect(s.getSnapshot().focusedMs).toBe(4000);
  });

  it("end는 요약을 확정하고 이후 update를 무시한다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(10_000, "focused");
    const summary = s.end(12_000);
    expect(summary.elapsedMs).toBe(12_000);
    expect(summary.focusRatio).toBe(1);
    s.update(20_000, "away");
    expect(s.getSnapshot().elapsedMs).toBe(12_000); // 변화 없음
  });
});

describe("SessionEngine — 이탈 집계", () => {
  it("away/head_down 구간은 distractedMs로 귀속되고 횟수를 센다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(10_000, "focused"); // 0~10초 집중
    s.update(10_000, "away"); // away 진입 (delta 0)
    s.update(15_000, "away"); // 10~15초 이탈
    s.update(15_000, "focused"); // 복귀
    s.update(20_000, "focused"); // 15~20초 집중
    const snap = s.getSnapshot();
    expect(snap.focusedMs).toBe(15_000);
    expect(snap.distractedMs).toBe(5_000);
    expect(snap.awayCount).toBe(1);
    expect(snap.headDownCount).toBe(0);
  });

  it("같은 상태 지속은 횟수를 다시 세지 않는다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(1000, "away");
    s.update(2000, "away");
    s.update(3000, "away");
    expect(s.getSnapshot().awayCount).toBe(1);
  });

  it("away → head_down → away 는 각각 카운트된다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(1000, "away");
    s.update(2000, "head_down");
    s.update(3000, "away");
    const snap = s.getSnapshot();
    expect(snap.awayCount).toBe(2);
    expect(snap.headDownCount).toBe(1);
  });

  it("focusRatio가 집중/전체 비율을 반영한다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(8000, "focused");
    s.update(8000, "away");
    s.update(10_000, "away");
    const summary = s.end(10_000);
    expect(summary.focusedMs).toBe(8000);
    expect(summary.distractedMs).toBe(2000);
    expect(summary.focusRatio).toBeCloseTo(0.8);
  });
});

describe("SessionEngine — 일시정지 (C-4)", () => {
  it("일시정지 구간은 elapsed에서 제외되고 pausedMs로 집계된다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(10_000, "focused");
    s.pause(10_000);
    s.update(20_000, "focused"); // 정지 중 10초
    s.resume(20_000);
    s.update(25_000, "focused"); // 재개 후 5초
    const snap = s.getSnapshot();
    expect(snap.elapsedMs).toBe(15_000);
    expect(snap.pausedMs).toBe(10_000);
    expect(snap.focusedMs).toBe(15_000);
  });

  it("일시정지 중에는 이탈 횟수를 세지 않는다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(1000, "focused");
    s.pause(1000);
    s.update(2000, "away"); // 정지 중 away — 카운트 금지
    s.resume(3000);
    expect(s.getSnapshot().awayCount).toBe(0);
  });

  it("paused 상태에서 바로 end해도 정합적이다", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(5000, "focused");
    s.pause(5000);
    const summary = s.end(8000);
    expect(summary.elapsedMs).toBe(5000);
    expect(summary.pausedMs).toBe(3000);
  });
});

describe("SessionEngine — 목표 시간 (C-2)", () => {
  it("목표 도달 여부와 남은 시간을 계산한다", () => {
    const s = new SessionEngine({ goalDurationMs: 10_000 });
    s.start(0);
    s.update(6000, "focused");
    expect(s.getSnapshot().remainingMs).toBe(4000);
    expect(s.getSnapshot().goalReached).toBe(false);
    s.update(10_000, "focused");
    expect(s.getSnapshot().remainingMs).toBe(0);
    expect(s.getSnapshot().goalReached).toBe(true);
    expect(s.end(10_000).goalReached).toBe(true);
  });

  it("자유 모드(goal null)면 remaining은 null", () => {
    const s = new SessionEngine();
    s.start(0);
    s.update(60_000, "focused");
    expect(s.getSnapshot().remainingMs).toBeNull();
    expect(s.getSnapshot().goalReached).toBe(false);
  });
});
