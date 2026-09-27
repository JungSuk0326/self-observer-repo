import { describe, expect, it } from "vitest";
import { DetectionEngine } from "./detectionEngine";

/** 테스트 헬퍼: t(ms) 시점의 입력 */
const present = (t: number, pitch = 0, yaw = 0) => ({ present: true, pitch, yaw, timestamp: t });
const absent = (t: number) => ({ present: false, pitch: 0, yaw: 0, timestamp: t });

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

describe("DetectionEngine — 시선 이탈 (D-3)", () => {
  const cfg = { lookAwayYawDeg: 35, lookAwayDelayMs: 3000, absenceDelayMs: 3000, turnedAbsenceDelayMs: 15_000 };

  it("옆을 본 채 지연 시간이 지나면 looking_away + look_away_start", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 50));
    expect(e.update(present(3500, 0, 50)).state).toBe("focused"); // 2.5초 — 아직
    const r = e.update(present(4000, 0, 50));
    expect(r.state).toBe("looking_away");
    expect(r.events).toEqual([{ type: "look_away_start", at: 4000 }]);
  });

  it("잠깐 옆을 보는 건(지연 미만) 판정하지 않는다", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 60));
    const r = e.update(present(2500, 0, 0));
    expect(r.state).toBe("focused");
    expect(r.events).toEqual([]);
  });

  it("정면으로 돌아오면 즉시 focused + look_away_end", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 50));
    e.update(present(5000, 0, 50)); // looking_away 확정
    const r = e.update(present(5100, 0, 5));
    expect(r.state).toBe("focused");
    expect(r.events).toEqual([{ type: "look_away_end", at: 5100 }]);
  });

  it("옆을 보던 중 얼굴을 놓치면 부재가 아니라 시선 이탈로 이어진다", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 45)); // 옆으로 돌리기 시작
    e.update(absent(1500)); // 45° 넘기며 추적 끊김
    // 정면 부재 기준(3s)이 지나도 away가 아니다
    expect(e.update(absent(5000)).state).toBe("looking_away");
    // 옆을 본 채 놓친 경우의 긴 지연(15s)이 지나야 부재
    expect(e.update(absent(16_000)).state).toBe("looking_away");
    const r = e.update(absent(16_600));
    expect(r.state).toBe("away");
    expect(r.events).toEqual([{ type: "absence_start", at: 16_600 }]);
  });

  it("정면에서 얼굴을 놓치면 기존대로 짧은 지연 뒤 부재", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0, 0, 5));
    e.update(absent(1000));
    expect(e.update(absent(4000)).state).toBe("away");
  });

  it("옆을 보다 놓친 뒤 돌아오면 이벤트로 복귀를 알린다", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 50));
    e.update(absent(1200));
    e.update(absent(5000)); // looking_away
    const r = e.update(present(5500, 0, 0));
    expect(r.state).toBe("focused");
    expect(r.events).toEqual([{ type: "look_away_end", at: 5500 }]);
  });

  it("옆을 보는 동안은 고개 숙임을 판정하지 않는다 (큰 yaw에서 pitch 불신)", () => {
    const e = new DetectionEngine({ ...cfg, headDownPitchDeg: 22, headDownDelayMs: 4000 });
    e.update(present(0));
    e.update(present(1000, 30, 50)); // pitch도 크고 yaw도 큼
    const r = e.update(present(6000, 30, 50));
    expect(r.state).toBe("looking_away");
    expect(r.events.map((x) => x.type)).not.toContain("head_down_start");
  });

  it("부재에서 돌아왔는데 여전히 옆을 보면 곧바로 시선 이탈", () => {
    const e = new DetectionEngine(cfg);
    e.update(present(0));
    e.update(present(1000, 0, 50));
    e.update(absent(1200));
    e.update(absent(20_000)); // away
    const r = e.update(present(20_500, 0, 50));
    expect(r.state).toBe("looking_away");
    expect(r.events.map((x) => x.type)).toEqual(["absence_end", "look_away_start"]);
  });
});
