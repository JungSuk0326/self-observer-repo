import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, formatGoalMinutes } from "./format";

describe("formatClock", () => {
  it("1시간 미만은 m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("1시간 이상은 h:mm:ss", () => {
    expect(formatClock(3_600_000)).toBe("1:00:00");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });

  it("음수는 0으로 막는다", () => {
    expect(formatClock(-5000)).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("분 단위로 읽어 준다", () => {
    expect(formatDuration(30_000)).toBe("1분 미만");
    expect(formatDuration(45 * 60_000)).toBe("45분");
    expect(formatDuration(60 * 60_000)).toBe("1시간");
    expect(formatDuration(90 * 60_000)).toBe("1시간 30분");
  });
});

describe("formatGoalMinutes", () => {
  it("자유 모드와 시간 단위를 구분한다", () => {
    expect(formatGoalMinutes(null)).toBe("자유");
    expect(formatGoalMinutes(25)).toBe("25분");
    expect(formatGoalMinutes(120)).toBe("2시간");
  });
});
