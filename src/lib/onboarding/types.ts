import type { CameraFailure } from "@/lib/vision/cameraError";

/**
 * 온보딩 단계 (UC-1). 랜딩에서 "바로 체험하기"를 누른 뒤의 흐름을 모두 덮는다.
 * 세션 화면과 같은 페이지에 머무는 이유: 라우팅으로 화면을 갈아타면 카메라
 * 스트림과 모델이 재초기화되어 사용자가 권한을 다시 묻게 된다.
 */
export type OnboardingStep =
  | "welcome" // 카메라가 필요한 이유 + 로컬 처리 고지 (A-3, A-5 고지)
  | "requesting" // 권한 요청 + 모델 로딩 중
  | "blocked" // 대체 흐름 — 원인별 안내 후 재시도
  | "avatar" // 아바타 프리셋 선택 (B-1)
  | "calibration" // 정면 응시 캘리브레이션 (B-2)
  | "ready" // 마스킹 확인 + 목표 시간 설정 (C-2)
  | "session"; // 집중 세션 진행 중 (UC-2)

/** 저장된 설정 — 재방문자는 아바타/캘리브레이션 단계를 건너뛴다 */
export interface SavedSetup {
  hasAvatar: boolean;
  hasCalibration: boolean;
}

export interface OnboardingState {
  step: OnboardingStep;
  /** blocked 단계에서 보여줄 원인. 그 외에는 null */
  failure: CameraFailure | null;
  /** blocked에 들어오기 직전 단계. 세션 중 끊김인지 구분해 안내가 달라진다 */
  blockedFrom: OnboardingStep | null;
  /** 얼굴 미검출 재배치 가이드 노출 여부 (UC-1 예외) */
  showFaceGuide: boolean;
}

/** 머신을 만들기 전(첫 렌더)에도 쓸 수 있는 초기 상태 */
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: "welcome",
  failure: null,
  blockedFrom: null,
  showFaceGuide: false,
};

export interface OnboardingConfig {
  /**
   * 얼굴 미검출이 이 시간(ms) 지속되면 재배치 가이드를 띄운다.
   * 감지 엔진과 같은 이유로 지연을 둔다 — 깜빡이는 가이드는 경고 오탐만큼 나쁘다.
   */
  faceLostDelayMs: number;
}

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  faceLostDelayMs: 2500,
};
