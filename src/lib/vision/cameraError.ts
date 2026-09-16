/**
 * 카메라/모델 준비 실패 원인 분류 (A-3).
 *
 * 온보딩의 대체 흐름은 원인별로 안내가 완전히 달라진다(권한 거부 vs 카메라 없음
 * vs HTTPS 아님). 브라우저가 던지는 DOMException 이름을 제품 용어로 한 번만
 * 번역해 두고, UI는 이 타입만 보고 분기한다.
 */
export type CameraFailure =
  | "denied" // 사용자가 권한 거부
  | "not_found" // 카메라 장치 없음
  | "in_use" // 다른 앱/탭이 카메라 점유
  | "insecure" // HTTPS(보안 컨텍스트) 아님 — 카메라 API 자체가 없음
  | "unsupported" // 브라우저가 getUserMedia 미지원
  | "model" // 카메라는 됐지만 얼굴 인식 모델 로딩 실패(네트워크 등)
  | "unknown";

/** 실패 원인을 실어 보내는 오류 — 훅이 UI에 원인을 전달하는 통로 */
export class CameraSetupError extends Error {
  constructor(
    readonly failure: CameraFailure,
    message: string,
  ) {
    super(message);
    this.name = "CameraSetupError";
  }
}

/**
 * 사실만 받아 판정하는 순수 함수 (테스트 대상).
 * 카메라 API가 없는 이유가 "HTTPS가 아니라서"인지 "브라우저가 못해서"인지
 * 구분해야 안내 문구가 달라진다.
 */
export function cameraAvailability(
  hasGetUserMedia: boolean,
  isSecureContext: boolean,
): CameraFailure | null {
  if (hasGetUserMedia) return null;
  // 보안 컨텍스트가 아니면 mediaDevices 자체가 노출되지 않는다
  return isSecureContext ? "unsupported" : "insecure";
}

/**
 * getUserMedia를 부르기 전에 확인할 수 있는 실패를 미리 걸러낸다.
 * 권한 프롬프트를 띄우기 전에 "HTTPS로 접속해 주세요"를 안내할 수 있어야 한다.
 */
export function checkCameraAvailability(): CameraFailure | null {
  if (typeof window === "undefined") return "unsupported"; // SSR
  return cameraAvailability(
    Boolean(navigator.mediaDevices?.getUserMedia),
    window.isSecureContext !== false,
  );
}

/** 브라우저 오류 → CameraFailure. 알 수 없는 오류는 "unknown"으로 남긴다. */
export function classifyCameraError(e: unknown): CameraFailure {
  if (e instanceof CameraSetupError) return e.failure;

  const name = typeof e === "object" && e !== null && "name" in e ? String(e.name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError": // 구형 스펙
    case "SecurityError":
      return name === "SecurityError" ? "insecure" : "denied";
    case "NotFoundError":
    case "DevicesNotFoundError": // 구형 스펙
    case "OverconstrainedError": // 요청한 해상도/전면 카메라를 만족하는 장치 없음
      return "not_found";
    case "NotReadableError":
    case "TrackStartError": // 구형 스펙
    case "AbortError":
      return "in_use";
    default:
      return "unknown";
  }
}
