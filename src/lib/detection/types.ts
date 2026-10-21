import type { HandSignal } from "@/lib/vision/types";

/** 사용자의 집중 상태 판정 결과 */
export type FocusState =
  | "initializing" // 첫 얼굴 검출 전
  | "focused"
  | "away" // 부재 (D-1)
  | "head_down" // 고개 숙임 지속 (D-2)
  | "looking_away" // 시선 이탈 — 고개를 옆으로 돌린 채 지속 (D-3)
  | "phone"; // 폰 들기 — 손이 얼굴 아래 앞에 떠 있고 고개가 숙여진 채 지속

/** 상태 전이 시 발생하는 이벤트 — 메시지 시스템(D-5)의 입력 */
export interface DetectionEvent {
  type:
    | "absence_start"
    | "absence_end"
    | "head_down_start"
    | "head_down_end"
    | "look_away_start"
    | "look_away_end"
    | "phone_start"
    | "phone_end"
    | "nose_pick_start"
    | "nose_pick_end";
  /** 이벤트 발생 시각 (입력 timestamp 기준) */
  at: number;
}

/** 엔진 입력 — FaceSignal에서 필요한 것만 추린 형태 */
export interface DetectionInput {
  present: boolean;
  /** 머리 pitch(도). 원시값(보간 없음)을 넣을 것 */
  pitch: number;
  /** 머리 yaw(도, 좌우). 캘리브레이션 보정을 거친 값을 넣을 것 */
  yaw: number;
  /** 손 신호. 손 추론이 없거나 얼굴이 없으면 null (손 관련 판정을 건너뛴다) */
  hand?: HandSignal | null;
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
  /** 시선 이탈 판정 yaw 임계값(도, 절댓값) */
  lookAwayYawDeg: number;
  /** yaw 초과가 이 시간(ms) 지속되어야 '시선 이탈' */
  lookAwayDelayMs: number;
  /**
   * 옆을 보던 중 얼굴을 놓친 경우의 부재 지연(ms).
   * 얼굴 모델은 정면 ±45° 근처에서 추적이 끊기므로, 옆을 본 채 사라진 얼굴은
   * "자리를 비웠다"가 아니라 "아직 옆을 보고 있다"로 먼저 해석한다.
   */
  turnedAbsenceDelayMs: number;

  /** 코 파기: 손가락 끝–코끝 거리가 이 값(얼굴 폭 단위) 이하 */
  nosePickDistance: number;
  /** 그 상태가 이 시간(ms) 지속되어야 판정 — 코 긁기·안경 올리기는 짧다 */
  nosePickDelayMs: number;

  /**
   * 폰 들기: 손 중심이 얼굴 아래 앞 구역(offsetY 범위, |offsetX| 이내)에 있고,
   * 손이 카메라에 가까우며(size ≥), 고개가 아래로 숙여진 채(pitch 범위) 지속.
   * 책상 위에서 필기하는 손은 더 아래·더 작게 보이고 고개가 더 많이 숙여진다.
   */
  phoneZoneYMin: number;
  phoneZoneYMax: number;
  phoneZoneXMax: number;
  phoneHandSizeMin: number;
  phonePitchMinDeg: number;
  phonePitchMaxDeg: number;
  phoneDelayMs: number;
}

/** 스파이크에서 실기 검증된 기본값 — 캘리브레이션(B-2)에서 사용자별 조정 예정 */
export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  absenceDelayMs: 3000,
  headDownPitchDeg: 22,
  headDownDelayMs: 4000,
  lookAwayYawDeg: 35,
  lookAwayDelayMs: 3000,
  turnedAbsenceDelayMs: 15_000,
  nosePickDistance: 0.12,
  nosePickDelayMs: 2500,
  phoneZoneYMin: 0.7,
  phoneZoneYMax: 2.4,
  phoneZoneXMax: 1.2,
  phoneHandSizeMin: 0.5,
  phonePitchMinDeg: 8,
  phonePitchMaxDeg: 45,
  phoneDelayMs: 6000,
};
