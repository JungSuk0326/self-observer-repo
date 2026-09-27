import { describe, expect, it } from "vitest";
import { NEUTRAL_POSE, PoseHold, TURNED_YAW_DEG } from "./poseHold";

const seen = (yaw: number, extra = {}) => ({ ...NEUTRAL_POSE, yaw, blinkL: 0.9, jaw: 0.5, ...extra });

describe("PoseHold — 얼굴을 놓친 동안의 자세", () => {
  it("본 적이 없으면 빈 자리", () => {
    expect(new PoseHold().estimate("focused")).toBeNull();
  });

  it("부재 판정이면 빈 자리, 상태를 모르면(렌더러 단독) 빈 자리", () => {
    const h = new PoseHold();
    h.observe(seen(10));
    expect(h.estimate("away")).toBeNull();
    expect(h.estimate(undefined)).toBeNull();
  });

  it("잠깐 놓치면 마지막 자세를 유지하되 표정은 풀린다", () => {
    const h = new PoseHold();
    h.observe(seen(10));
    let p = h.estimate("focused")!;
    for (let i = 0; i < 60; i++) p = h.estimate("focused")!;
    expect(p.yaw).toBeCloseTo(10, 1);
    expect(p.blinkL).toBeLessThan(0.01);
    expect(p.jaw).toBeLessThan(0.01);
  });

  it("시선 이탈이면 마지막 방향으로 옆모습까지 돌아간다", () => {
    const h = new PoseHold();
    h.observe(seen(-40));
    let p = h.estimate("looking_away")!;
    for (let i = 0; i < 80; i++) p = h.estimate("looking_away")!;
    expect(p.yaw).toBeCloseTo(-TURNED_YAW_DEG, 0);
  });

  it("얼굴이 다시 보이면 새 자세로 덮어쓴다", () => {
    const h = new PoseHold();
    h.observe(seen(50));
    h.estimate("looking_away");
    h.observe(seen(0));
    expect(h.estimate("focused")!.yaw).toBeCloseTo(0, 5);
  });
});
