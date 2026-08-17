/** 사용자의 집중 상태 판정 결과 */
export type FocusState =
  | "initializing" // 첫 얼굴 검출 전
  | "focused"
  | "away" // 부재 (D-1)
  | "head_down"; // 고개 숙임 지속 (D-2)

/** 상태 전이 시 발생하는 이벤트 — 메시지 시스템(D-5)의 입력 */
export interface DetectionEvent {
  type: "absence_start" | "absence_end" | "head_down_start" | "head_down_end";
  /** 이벤트 발생 시각 (입력 timestamp 기준) */
  at: number;
}

/** 엔진 입력 — FaceSignal에서 필요한 것만 추린 형태 */
export interface DetectionInput {
  present: boolean;
  /** 머리 pitch(도). 원시값(보간 없음)을 넣을 것 */
  pitch: number;
  /** 단조 증가 타임스탬프(ms). performance.now() 등 */
  timestamp: number;
}

/**
 * 오탐 방지 파라미터 (아키텍처 원칙 4).
 * 모든 판정은 임계값 + 지속 시간 조건을 함께 만족해야 한다.
 */
export interface DetectionConfig {
  /** 얼굴 미검출이 이 시간(ms) 지속되어야 '부재' */
  absenceDelayMs: number;
  /** 고개 숙임 판정 pitch 임계값(도, 절댓값) */
  headDownPitchDeg: number;
  /** pitch 초과가 이 시간(ms) 지속되어야 '고개 숙임' */
  headDownDelayMs: number;
}

/** 스파이크에서 실기 검증된 기본값 — 캘리브레이션(B-2)에서 사용자별 조정 예정 */
export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  absenceDelayMs: 3000,
  headDownPitchDeg: 22,
  headDownDelayMs: 4000,
};
