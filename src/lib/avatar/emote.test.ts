import { describe, expect, it } from "vitest";
import { applyEmoteToPose, emoteForMessage, emoteWeight } from "./emote";
import { NEUTRAL_POSE } from "./poseHold";

describe("emote — 메시지 → 아바타 표정", () => {
  it("격려는 웃음, 시선 이탈은 놀람, 졸음은 나른함", () => {
    expect(emoteForMessage("focus_milestone", 0)?.name).toBe("happy");
    expect(emoteForMessage("look_away", 0)?.name).toBe("surprised");
    expect(emoteForMessage("head_down", 0)?.name).toBe("relaxed");
  });

  it("자리 비움 경고엔 표정을 얹지 않는다 (얼굴이 안 보이는 중)", () => {
    expect(emoteForMessage("away", 0)).toBeNull();
  });

  it("세기는 올라갔다 유지되고 끝에서 빠진 뒤 0이 된다", () => {
    const e = emoteForMessage("goal_reached", 1000)!;
    expect(emoteWeight(e, 1000)).toBe(0);
    expect(emoteWeight(e, 1100)).toBeCloseTo(0.5, 5); // 페이드인 절반
    expect(emoteWeight(e, 3000)).toBe(1); // 유지
    expect(emoteWeight(e, 1000 + e.durationMs - 250)).toBeCloseTo(0.5, 5); // 페이드아웃 절반
    expect(emoteWeight(e, 1000 + e.durationMs)).toBe(0);
    expect(emoteWeight(null, 0)).toBe(0);
  });

  it("2D 근사는 추적 값을 낮추지 않고 올리기만 한다", () => {
    const tracked = { ...NEUTRAL_POSE, smile: 0.9, yaw: 20 };
    const p = applyEmoteToPose(tracked, "happy", 0.3);
    expect(p.smile).toBe(0.9);
    expect(p.yaw).toBe(20);
    expect(applyEmoteToPose(NEUTRAL_POSE, "surprised", 1).brow).toBe(1);
  });
});
