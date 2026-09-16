import { describe, expect, it } from "vitest";
import { CameraSetupError, cameraAvailability, classifyCameraError } from "./cameraError";

/** DOMException이 없는 환경도 있으므로 name만 가진 객체로 대체 */
function err(name: string) {
  return Object.assign(new Error(name), { name });
}

describe("classifyCameraError", () => {
  it("권한 거부를 denied로 분류한다", () => {
    expect(classifyCameraError(err("NotAllowedError"))).toBe("denied");
    expect(classifyCameraError(err("PermissionDeniedError"))).toBe("denied");
  });

  it("장치 없음/제약 불만족을 not_found로 분류한다", () => {
    expect(classifyCameraError(err("NotFoundError"))).toBe("not_found");
    expect(classifyCameraError(err("DevicesNotFoundError"))).toBe("not_found");
    expect(classifyCameraError(err("OverconstrainedError"))).toBe("not_found");
  });

  it("점유 중을 in_use로 분류한다", () => {
    expect(classifyCameraError(err("NotReadableError"))).toBe("in_use");
    expect(classifyCameraError(err("TrackStartError"))).toBe("in_use");
  });

  it("SecurityError는 insecure로 분류한다", () => {
    expect(classifyCameraError(err("SecurityError"))).toBe("insecure");
  });

  it("CameraSetupError는 실린 원인을 그대로 쓴다", () => {
    expect(classifyCameraError(new CameraSetupError("model", "모델 로딩 실패"))).toBe(
      "model",
    );
  });

  it("모르는 오류는 unknown으로 남긴다", () => {
    expect(classifyCameraError(err("WeirdError"))).toBe("unknown");
    expect(classifyCameraError("문자열 오류")).toBe("unknown");
    expect(classifyCameraError(null)).toBe("unknown");
  });
});

describe("cameraAvailability", () => {
  it("getUserMedia가 있으면 문제 없음", () => {
    expect(cameraAvailability(true, true)).toBe(null);
  });

  it("보안 컨텍스트가 아니면 insecure — HTTPS 안내가 필요하다", () => {
    expect(cameraAvailability(false, false)).toBe("insecure");
  });

  it("HTTPS인데도 API가 없으면 unsupported", () => {
    expect(cameraAvailability(false, true)).toBe("unsupported");
  });
});
