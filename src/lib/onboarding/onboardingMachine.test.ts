import { describe, expect, it } from "vitest";
import { OnboardingMachine } from "./onboardingMachine";

/** welcome → requesting → 카메라 준비 완료까지 진행한 머신 */
function ready(saved = { hasAvatar: true, hasCalibration: true }) {
  const m = new OnboardingMachine();
  m.begin();
  m.cameraReady(saved);
  return m;
}

describe("OnboardingMachine — 정상 흐름 (UC-1)", () => {
  it("첫 방문자는 아바타 → 캘리브레이션 → 준비 → 세션 순으로 진행한다", () => {
    const m = new OnboardingMachine();
    expect(m.currentStep).toBe("welcome");

    m.begin();
    expect(m.currentStep).toBe("requesting");

    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    expect(m.currentStep).toBe("avatar");

    m.chooseAvatar();
    expect(m.currentStep).toBe("calibration");

    m.finishCalibration();
    expect(m.currentStep).toBe("ready");

    m.startSession();
    expect(m.currentStep).toBe("session");
  });

  it("세션을 끝내면 준비 화면으로 돌아온다", () => {
    const m = ready();
    m.startSession();
    m.endSession();
    expect(m.currentStep).toBe("ready");
  });

  it("준비 화면에서 아바타만 바꾸면 캘리브레이션 없이 준비로 돌아온다", () => {
    const m = ready();
    m.editAvatar();
    expect(m.currentStep).toBe("avatar");
    m.chooseAvatar();
    expect(m.currentStep).toBe("ready");
  });

  it("아바타 변경 중 카메라가 끊겨도 복구 후 준비 화면으로 돌아온다", () => {
    const m = ready();
    m.editAvatar();
    m.cameraFailed("in_use");
    m.begin();
    m.cameraReady({ hasAvatar: true, hasCalibration: true });
    expect(m.currentStep).toBe("ready");
  });

  it("준비 화면에서 재캘리브레이션 후 다시 준비로 돌아온다", () => {
    const m = ready();
    m.startCalibration();
    expect(m.currentStep).toBe("calibration");
    m.finishCalibration();
    expect(m.currentStep).toBe("ready");
  });
});

describe("OnboardingMachine — 재방문자 단계 건너뛰기", () => {
  it("아바타·캘리브레이션이 모두 저장돼 있으면 준비 화면으로 바로 간다", () => {
    expect(ready().currentStep).toBe("ready");
  });

  it("아바타만 저장돼 있으면 캘리브레이션부터 한다", () => {
    const m = ready({ hasAvatar: true, hasCalibration: false });
    expect(m.currentStep).toBe("calibration");
  });

  it("저장된 게 없으면 아바타 선택부터 한다", () => {
    const m = ready({ hasAvatar: false, hasCalibration: true });
    expect(m.currentStep).toBe("avatar");
  });
});

describe("OnboardingMachine — 대체 흐름 (권한 거부 등)", () => {
  it("권한 거부는 원인을 실은 blocked 단계로 간다", () => {
    const m = new OnboardingMachine();
    m.begin();
    m.cameraFailed("denied");
    expect(m.getState()).toMatchObject({
      step: "blocked",
      failure: "denied",
      blockedFrom: "requesting", // 세션 중 끊김이 아니다
    });
  });

  it("재시도하면 다시 권한 요청으로 가고 원인이 지워진다", () => {
    const m = new OnboardingMachine();
    m.begin();
    m.cameraFailed("insecure");
    m.begin();
    expect(m.getState()).toMatchObject({ step: "requesting", failure: null });
  });

  it("blocked 단계에서 다른 실패가 겹쳐도 첫 원인을 유지한다", () => {
    const m = new OnboardingMachine();
    m.begin();
    m.cameraFailed("denied");
    m.cameraFailed("unknown");
    expect(m.getState().failure).toBe("denied");
  });

  it("세션 중 카메라가 끊기면 복구 후 진행 중이던 세션으로 돌아온다", () => {
    const m = ready();
    m.startSession();
    m.cameraFailed("in_use");
    expect(m.getState()).toMatchObject({ step: "blocked", blockedFrom: "session" });

    m.begin();
    // 첫 방문자처럼 아바타 선택으로 되돌리지 않고, 세션도 버리지 않는다
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    expect(m.currentStep).toBe("session");
  });

  it("준비 화면에서 끊기면 복구 후 준비 화면으로 돌아온다", () => {
    const m = ready();
    m.cameraFailed("unknown");
    m.begin();
    m.cameraReady({ hasAvatar: true, hasCalibration: true });
    expect(m.currentStep).toBe("ready");
  });

  it("아바타 선택 중 끊기면 복구 후 저장 상태 기준으로 다시 안내한다", () => {
    const m = new OnboardingMachine();
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    m.cameraFailed("in_use");
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    expect(m.currentStep).toBe("avatar");
  });
});

describe("OnboardingMachine — 얼굴 미검출 가이드 (UC-1 예외)", () => {
  it("미검출이 지연 시간을 넘겨 지속되면 가이드를 띄운다", () => {
    const m = new OnboardingMachine({ faceLostDelayMs: 2500 });
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });

    m.observe(1000, false);
    expect(m.getState().showFaceGuide).toBe(false); // 아직 지연 안 지남
    m.observe(2000, false);
    expect(m.getState().showFaceGuide).toBe(false);
    m.observe(3500, false);
    expect(m.getState().showFaceGuide).toBe(true);
  });

  it("얼굴이 다시 보이면 즉시 가이드를 내린다", () => {
    const m = new OnboardingMachine({ faceLostDelayMs: 1000 });
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    m.observe(0, false);
    m.observe(2000, false);
    expect(m.getState().showFaceGuide).toBe(true);
    m.observe(2200, true);
    expect(m.getState().showFaceGuide).toBe(false);
  });

  it("짧은 미검출(프레임 드랍)은 가이드를 띄우지 않는다", () => {
    const m = new OnboardingMachine({ faceLostDelayMs: 2500 });
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    m.observe(0, true);
    m.observe(500, false);
    m.observe(1000, true);
    m.observe(1500, false);
    expect(m.getState().showFaceGuide).toBe(false);
  });

  it("세션 중에는 가이드를 띄우지 않는다 — 부재는 감지 엔진의 몫", () => {
    const m = ready();
    m.startSession();
    m.observe(0, false);
    m.observe(10_000, false);
    expect(m.getState().showFaceGuide).toBe(false);
  });

  it("가이드 상태가 바뀐 tick에만 true를 반환한다", () => {
    const m = new OnboardingMachine({ faceLostDelayMs: 1000 });
    m.begin();
    m.cameraReady({ hasAvatar: false, hasCalibration: false });
    expect(m.observe(0, false)).toBe(false);
    expect(m.observe(1500, false)).toBe(true); // 노출로 전환
    expect(m.observe(2000, false)).toBe(false); // 유지
    expect(m.observe(2500, true)).toBe(true); // 해제로 전환
  });

  it("세션을 시작하면 남아 있던 가이드가 내려간다", () => {
    const m = ready();
    m.observe(0, false);
    m.observe(5000, false);
    expect(m.getState().showFaceGuide).toBe(true);
    m.startSession();
    expect(m.getState().showFaceGuide).toBe(false);
  });
});
