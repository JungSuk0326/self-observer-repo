import type { CameraFailure } from "@/lib/vision/cameraError";
import type {
  OnboardingConfig,
  OnboardingState,
  OnboardingStep,
  SavedSetup,
} from "./types";
import { DEFAULT_ONBOARDING_CONFIG } from "./types";

/** 얼굴 가이드를 띄울 단계 — 세션 중 부재는 감지 엔진(D-1)의 몫이라 제외 */
const FACE_GUIDE_STEPS: readonly OnboardingStep[] = ["avatar", "calibration", "ready"];

/**
 * 온보딩 흐름 상태 머신 (UC-1).
 *
 * 다른 엔진들과 같은 순수 로직 — DOM/카메라/React를 모르고, 시간은 호출부가
 * 넣는 timestamp로만 흐른다. 페이지는 "지금 무엇을 보여줄지"를 이 머신에만 묻고,
 * 카메라·저장소 같은 부수효과는 페이지가 맡는다.
 *
 * 설계 포인트:
 * - 실패는 단계가 아니라 원인(CameraFailure)으로 남긴다. 안내 문구가 원인별로
 *   완전히 다르기 때문(권한 거부 vs HTTPS 아님 vs 카메라 점유).
 * - 재방문자는 저장된 아바타/캘리브레이션만큼 단계를 건너뛴다. 매번 같은
 *   온보딩을 다시 밟게 하면 재방문 자체를 포기한다.
 * - 세션 중 카메라가 끊겨도 세션을 버리지 않는다. blocked로 갔다가 복구되면
 *   ready로 돌아오고, 세션(일시정지 상태)은 페이지가 그대로 들고 있는다.
 */
export class OnboardingMachine {
  private readonly config: OnboardingConfig;
  private step: OnboardingStep = "welcome";
  private failure: CameraFailure | null = null;
  private faceLostSince: number | null = null;
  private faceGuide = false;
  /** blocked 이전 단계 — 복구 후 어디로 돌아갈지 */
  private stepBeforeBlock: OnboardingStep | null = null;
  /** ready에서 아바타만 다시 고르는 중인지 — 캘리브레이션을 다시 시키지 않는다 */
  private editingAvatar = false;

  constructor(config: Partial<OnboardingConfig> = {}) {
    this.config = { ...DEFAULT_ONBOARDING_CONFIG, ...config };
  }

  getState(): OnboardingState {
    const blocked = this.step === "blocked";
    return {
      step: this.step,
      failure: blocked ? this.failure : null,
      blockedFrom: blocked ? this.stepBeforeBlock : null,
      showFaceGuide: this.faceGuide,
    };
  }

  get currentStep(): OnboardingStep {
    return this.step;
  }

  /** "바로 체험하기" / 재시도 — 권한 요청을 시작한다 */
  begin(): void {
    if (this.step !== "welcome" && this.step !== "blocked") return;
    this.failure = null;
    this.step = "requesting";
  }

  /** 카메라 + 모델 준비 완료. 저장된 설정만큼 단계를 건너뛴다 */
  cameraReady(saved: SavedSetup = { hasAvatar: false, hasCalibration: false }): void {
    if (this.step !== "requesting") return;
    // 카메라가 끊겼다 복구된 경우엔 끊기기 전 자리로 돌려보낸다.
    // 세션 중이었다면 세션을 버리지 않는다 — 호출부가 일시정지해 둔 세션을
    // 그대로 들고 있고, 사용자는 "재개"만 누르면 된다 (UC-2 예외).
    if (this.stepBeforeBlock === "session" || this.stepBeforeBlock === "ready") {
      this.step = this.stepBeforeBlock;
      this.stepBeforeBlock = null;
      this.resetFaceGuide();
      return;
    }
    this.stepBeforeBlock = null;
    this.editingAvatar = false;
    this.step = !saved.hasAvatar
      ? "avatar"
      : saved.hasCalibration
        ? "ready"
        : "calibration";
    this.resetFaceGuide();
  }

  /** 준비 실패 또는 세션 중 카메라 끊김 — 어느 단계에서든 대체 흐름으로 */
  cameraFailed(failure: CameraFailure): void {
    if (this.step === "blocked") return;
    this.stepBeforeBlock = this.step;
    this.failure = failure;
    this.step = "blocked";
    this.resetFaceGuide();
  }

  /** 준비 화면에서 아바타만 다시 고르기 */
  editAvatar(): void {
    if (this.step !== "ready") return;
    this.editingAvatar = true;
    this.step = "avatar";
  }

  /**
   * 아바타 선택 확정. 첫 온보딩이면 캘리브레이션으로 이어지고,
   * 준비 화면에서 바꾼 것뿐이면 그대로 준비 화면으로 돌아간다.
   */
  chooseAvatar(): void {
    if (this.step !== "avatar") return;
    this.step = this.editingAvatar ? "ready" : "calibration";
    this.editingAvatar = false;
  }

  /** 캘리브레이션 시작(ready에서 재캘리브레이션 포함) */
  startCalibration(): void {
    if (this.step === "ready" || this.step === "avatar") this.step = "calibration";
  }

  /** 캘리브레이션 완료 또는 건너뛰기 — baseline 없이도 기본 임계값으로 동작한다 */
  finishCalibration(): void {
    if (this.step === "calibration") this.step = "ready";
  }

  startSession(): void {
    if (this.step !== "ready") return;
    this.step = "session";
    // 남아 있던 재배치 가이드는 내린다 — 세션에선 부재 감지가 이어받는다
    this.resetFaceGuide();
  }

  endSession(): void {
    if (this.step === "session") {
      this.step = "ready";
      this.resetFaceGuide();
    }
  }

  /**
   * 매 tick(5Hz 권장) 얼굴 검출 여부를 넣는다.
   * 반환값은 가이드 노출 여부가 이번 tick에 바뀌었는지 — 리렌더 판단에 쓴다.
   */
  observe(timestamp: number, present: boolean): boolean {
    const before = this.faceGuide;
    if (!FACE_GUIDE_STEPS.includes(this.step)) {
      this.resetFaceGuide();
      return before !== this.faceGuide;
    }
    if (present) {
      this.resetFaceGuide();
    } else {
      this.faceLostSince ??= timestamp;
      if (timestamp - this.faceLostSince >= this.config.faceLostDelayMs) {
        this.faceGuide = true;
      }
    }
    return before !== this.faceGuide;
  }

  private resetFaceGuide(): void {
    this.faceLostSince = null;
    this.faceGuide = false;
  }
}
