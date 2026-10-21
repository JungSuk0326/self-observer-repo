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
/**
 * 손 신호 — 얼굴 기준 상대 좌표 (단위: 얼굴 폭). 카메라 거리와 무관하게 쓰기 위해
 * 픽셀이 아니라 얼굴 폭으로 정규화한다. 얼굴이 없으면 계산하지 않는다.
 */
export interface HandSignal {
  /** 손 검출 여부 */
  present: boolean;
  /** 다섯 손가락 끝 중 코끝에 가장 가까운 것까지의 거리 (얼굴 폭 단위) */
  fingerToNose: number;
  /** 손 중심 − 얼굴 중심. x: + 화면 오른쪽, y: + 아래 (얼굴 폭 단위) */
  offsetX: number;
  offsetY: number;
  /** 손 바운딩 박스 대각선 / 얼굴 폭 — 카메라에 가까울수록 커진다 */
  size: number;
}

export interface FaceSignal {
  /** 얼굴 검출 여부 (부재 감지의 입력) */
  present: boolean;
  /** 원시 머리 자세 — 감지 로직용 (보간 없음) */
  pose: HeadPose;
  /** 렌더링용 보간(smoothed) 값 — 저주기 추론을 부드럽게 */
  smoothed: HeadPose & Expression;
  /** 손 신호 — 손 추론이 꺼져 있거나 얼굴이 없으면 null */
  hand: HandSignal | null;
  /** 손 모델이 로딩돼 있는가 (false면 손 딴짓 감지가 통째로 빠진 상태) */
  handModelReady: boolean;
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
