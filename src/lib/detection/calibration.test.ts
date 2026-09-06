import { describe, expect, it } from "vitest";
import { Calibrator, applyBaseline } from "./calibration";

const pose = (pitch: number, yaw = 0, roll = 0) => ({ pitch, yaw, roll });

describe("Calibrator", () => {
  it("진행률이 샘플 수에 비례해 오르고 완료 시 1이 된다", () => {
    const c = new Calibrator(4);
    expect(c.addSample(pose(0))).toBe(0.25);
    expect(c.addSample(pose(0))).toBe(0.5);
    c.addSample(pose(0));
    expect(c.isComplete).toBe(false);
    expect(c.addSample(pose(0))).toBe(1);
    expect(c.isComplete).toBe(true);
  });

  it("완료 전에는 baseline이 null", () => {
    const c = new Calibrator(3);
    c.addSample(pose(10));
    expect(c.getBaseline()).toBeNull();
  });

  it("baseline은 축별 중앙값 — 순간 이상치(고개 돌림)에 흔들리지 않는다", () => {
    const c = new Calibrator(5);
    c.addSample(pose(8, 2));
    c.addSample(pose(9, 1));
    c.addSample(pose(10, 0));
    c.addSample(pose(11, -1));
    c.addSample(pose(60, 40)); // 캘리브레이션 중 잠깐 딴 데 봄
    expect(c.getBaseline()).toEqual({ pitch: 10, yaw: 1, roll: 0 });
  });

  it("완료 후 추가 샘플은 무시된다", () => {
    const c = new Calibrator(2);
    c.addSample(pose(10));
    c.addSample(pose(10));
    c.addSample(pose(999));
    expect(c.getBaseline()?.pitch).toBe(10);
  });

  it("reset하면 처음부터 다시 모은다", () => {
    const c = new Calibrator(2);
    c.addSample(pose(10));
    c.reset();
    expect(c.progress).toBe(0);
    expect(c.isComplete).toBe(false);
  });
});

describe("applyBaseline", () => {
  it("기준 자세를 0점으로 보정한다", () => {
    // 카메라가 낮아 정면이 pitch 15로 잡히는 사용자
    const baseline = pose(15, -3, 1);
    expect(applyBaseline(pose(15, -3, 1), baseline)).toEqual(pose(0, 0, 0));
    // 실제로 22도 더 숙이면 보정 후 22
    expect(applyBaseline(pose(37, -3, 1), baseline).pitch).toBe(22);
  });

  it("baseline이 없으면 원본 그대로", () => {
    expect(applyBaseline(pose(12, 3, -2), null)).toEqual(pose(12, 3, -2));
  });
});
