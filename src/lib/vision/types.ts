/** 머리 자세 (도 단위). pitch: 끄덕임(+아래), yaw: 도리도리, roll: 갸웃 */
export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

/** 아바타 구동용 표정 수치 (0~1) */
export interface Expression {
  blinkL: number;
  blinkR: number;
  jaw: number;
  brow: number;
  smile: number;
}

/**
 * 비전 파이프라인의 프레임당 출력.
 * 함께 모드에서 동료에게 전송되는 것도 정확히 이 데이터다(영상 아님) —
 * 아키텍처 원칙 2 (CLAUDE.md).
 */
export interface FaceSignal {
  /** 얼굴 검출 여부 (부재 감지의 입력) */
  present: boolean;
  /** 원시 머리 자세 — 감지 로직용 (보간 없음) */
  pose: HeadPose;
  /** 렌더링용 보간(smoothed) 값 — 저주기 추론을 부드럽게 */
  smoothed: HeadPose & Expression;
  /** performance.now() 기준 타임스탬프 */
  timestamp: number;
}

export interface TrackerStats {
  /** 렌더 루프 FPS (이동 평균) */
  fps: number;
  /** 추론 1회 소요 ms (이동 평균) */
  inferMs: number;
}

export type FaceFrameCallback = (signal: FaceSignal, stats: TrackerStats) => void;
