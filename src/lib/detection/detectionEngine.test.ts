import { describe, expect, it } from "vitest";
import { DetectionEngine } from "./detectionEngine";

/** 테스트 헬퍼: t(ms) 시점의 입력 */
const present = (t: number, pitch = 0) => ({ present: true, pitch, timestamp: t });
const absent = (t: number) => ({ present: false, pitch: 0, timestamp: t });

describe("DetectionEngine — 초기화", () => {
  it("첫 얼굴 검출 전에는 부재를 판정하지 않는다 (카메라 준비 중 오탐 방지)", () => {
    const engine = new DetectionEngine();
    // 얼굴이 한 번도 안 잡힌 채 10초 경과해도 initializing 유지
    expect(engine.update(absent(0)).state).toBe("initializing");
    expect(engine.update(absent(10_000)).state).toBe("initializing");
    // 첫 검출로 focused 진입
    expect(engine.update(present(11_000)).state).toBe("focused");
  });
});

describe("DetectionEngine — 부재 감지 (D-1)", () => {
  it("지연 시간 이상 얼굴이 없으면 away + absence_start 이벤트", () => {
    const engine = new DetectionEngine({ absenceDelayMs: 3000 });
    engine.update(present(0));
    engine.update(absent(1000));
    expect(engine.update(absent(3500)).state).toBe("focused"); // 2.5초 — 아직
    const result = engine.update(absent(4000)); // 3초 경과
    expect(result.state).toBe("away");
    expect(result.events).toEqual([{ type: "absence_start", at: 4000 }]);
  });

  it("잠깐 자리 비움(지연 미만)은 경고하지 않는다 — 오탐 방지 핵심", () => {
    const engine = new DetectionEngine({ absenceDelayMs: 3000 });
    engine.update(present(0));
    engine.update(absent(1000));
    engine.update(absent(3500)); // 2.5초 부재
    const result = engine.update(present(3900)); // 복귀
    expect(result.state).toBe("focused");
    expect(result.events).toEqual([]); // 아무 이벤트도 없어야 함
  });

  it("복귀는 지연 없이 즉시 + absence_end 이벤트", () => {
    const engine = new DetectionEngine({ absenceDelayMs: 3000 });
    engine.update(present(0));
    engine.update(absent(1000));
    engine.update(absent(5000)); // away 확정
    const result = engine.update(present(5100));
    expect(result.state).toBe("focused");
    expect(result.events).toEqual([{ type: "absence_end", at: 5100 }]);
  });

  it("absence_start는 한 번만 발생한다 (부재 지속 중 반복 발화 금지)", () => {
    const engine = new DetectionEngine({ absenceDelayMs: 3000 });
    engine.update(present(0));
    engine.update(absent(1000));
    engine.update(absent(4001)); // absence_start
    const result = engine.update(absent(10_000)); // 계속 부재
    expect(result.state).toBe("away");
    expect(result.events).toEqual([]);
  });
});

describe("DetectionEngine — 고개 숙임 감지 (D-2)", () => {
  it("임계값 초과 pitch가 지연 시간 지속되면 head_down", () => {
    const engine = new DetectionEngine({ headDownPitchDeg: 22, headDownDelayMs: 4000 });
    engine.update(present(0, 0));
    engine.update(present(1000, 30));
    expect(engine.update(present(4500, 30)).state).toBe("focused"); // 3.5초 — 아직
    const result = engine.update(present(5000, 30)); // 4초 경과
    expect(result.state).toBe("head_down");
    expect(result.events).toEqual([{ type: "head_down_start", at: 5000 }]);
  });

  it("잠깐 고개 숙임(지연 미만)은 경고하지 않는다 — 오탐 방지 핵심", () => {
    const engine = new DetectionEngine({ headDownPitchDeg: 22, headDownDelayMs: 4000 });
    engine.update(present(0, 0));
    engine.update(present(1000, 35)); // 물 마시기/스트레칭
    const result = engine.update(present(3000, 5)); // 2초 만에 복귀
    expect(result.state).toBe("focused");
    expect(result.events).toEqual([]);
  });

  it("고개를 들면 즉시 focused 복귀 + head_down_end", () => {
    const engine = new DetectionEngine({ headDownPitchDeg: 22, headDownDelayMs: 4000 });
    engine.update(present(0, 0));
    engine.update(present(1000, 30));
    engine.update(present(5001, 30)); // head_down 확정
    const result = engine.update(present(6000, 3));
    expect(result.state).toBe("focused");
    expect(result.events).toEqual([{ type: "head_down_end", at: 6000 }]);
  });

  it("위로 젖힘(음수 pitch)도 절댓값으로 판정한다", () => {
    const engine = new DetectionEngine({ headDownPitchDeg: 22, headDownDelayMs: 4000 });
    engine.update(present(0, 0));
    engine.update(present(1000, -30));
    expect(engine.update(present(5001, -30)).state).toBe("head_down");
  });
});

describe("DetectionEngine — 상태 간 상호작용", () => {
  it("고개 숙임 누적 중 부재가 되면 고개 숙임 타이머는 리셋된다", () => {
    const engine = new DetectionEngine({
      absenceDelayMs: 3000,
      headDownPitchDeg: 22,
      headDownDelayMs: 4000,
    });
    engine.update(present(0, 0));
    engine.update(present(1000, 30)); // 고개 숙임 시작 (3초 누적하면 5000에 확정될 상황)
    engine.update(absent(2000)); // 자리 비움 — 타이머 리셋되어야 함
    engine.update(present(2500, 30)); // 복귀 후 다시 숙임
    // 이전 누적이 리셋됐으므로 2500+4000=6500 전에는 head_down 아님
    expect(engine.update(present(6000, 30)).state).toBe("focused");
    expect(engine.update(present(6500, 30)).state).toBe("head_down");
  });

  it("away 상태에서 고개 숙인 채 복귀하면 absence_end 후 별도로 head_down 판정", () => {
    const engine = new DetectionEngine({
      absenceDelayMs: 3000,
      headDownPitchDeg: 22,
      headDownDelayMs: 4000,
    });
    engine.update(present(0, 0));
    engine.update(absent(1000));
    engine.update(absent(4001)); // away
    const back = engine.update(present(5000, 30)); // 고개 숙인 채 복귀
    expect(back.state).toBe("focused");
    expect(back.events).toEqual([{ type: "absence_end", at: 5000 }]);
    // 복귀 시점부터 다시 4초 지속해야 head_down
    expect(engine.update(present(8999, 30)).state).toBe("focused");
    expect(engine.update(present(9000, 30)).state).toBe("head_down");
  });

  it("reset하면 initializing으로 돌아간다", () => {
    const engine = new DetectionEngine();
    engine.update(present(0));
    engine.reset();
    expect(engine.currentState).toBe("initializing");
    expect(engine.update(absent(100)).state).toBe("initializing");
  });
});
