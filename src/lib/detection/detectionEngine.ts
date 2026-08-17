import type {
  DetectionConfig,
  DetectionEvent,
  DetectionInput,
  FocusState,
} from "./types";
import { DEFAULT_DETECTION_CONFIG } from "./types";

export interface DetectionResult {
  state: FocusState;
  /** 이번 update에서 발생한 상태 전이 이벤트 (없으면 빈 배열) */
  events: DetectionEvent[];
}

/**
 * 부재/고개숙임 판정 상태 머신 (D-1, D-2, D-4).
 *
 * 순수 로직 — DOM/시간/React 의존 없음. 시간은 입력 timestamp로만 흐르므로
 * 단위 테스트에서 임의로 시간을 진행시킬 수 있다.
 *
 * 오탐 방지 설계(아키텍처 원칙 4):
 * - 모든 판정은 "임계값 초과가 delay만큼 지속"되어야 확정된다.
 *   잠깐의 스트레칭·고개 돌림·프레임 드랍은 상태를 바꾸지 않는다.
 * - 부재 중 얼굴이 다시 보이면 즉시 복귀한다(복귀는 지연 없음 —
 *   돌아온 사용자를 기다리게 하는 것이 더 나쁜 경험).
 */
export class DetectionEngine {
  private readonly config: DetectionConfig;
  private state: FocusState = "initializing";
  private noFaceSince: number | null = null;
  private headDownSince: number | null = null;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
  }

  get currentState(): FocusState {
    return this.state;
  }

  update(input: DetectionInput): DetectionResult {
    const { present, pitch, timestamp } = input;
    const events: DetectionEvent[] = [];

    // 첫 얼굴 검출 전에는 판정하지 않는다 (카메라 준비 중 오탐 방지)
    if (this.state === "initializing") {
      if (present) this.state = "focused";
      return { state: this.state, events };
    }

    if (!present) {
      this.headDownSince = null;
      this.noFaceSince ??= timestamp;
      if (
        this.state !== "away" &&
        timestamp - this.noFaceSince >= this.config.absenceDelayMs
      ) {
        this.state = "away";
        events.push({ type: "absence_start", at: timestamp });
      }
      return { state: this.state, events };
    }

    // 얼굴 있음 — 부재였다면 즉시 복귀
    this.noFaceSince = null;
    if (this.state === "away") {
      this.state = "focused";
      events.push({ type: "absence_end", at: timestamp });
    }

    // 고개 숙임 판정 (얼굴이 있을 때만)
    if (Math.abs(pitch) >= this.config.headDownPitchDeg) {
      this.headDownSince ??= timestamp;
      if (
        this.state !== "head_down" &&
        timestamp - this.headDownSince >= this.config.headDownDelayMs
      ) {
        this.state = "head_down";
        events.push({ type: "head_down_start", at: timestamp });
      }
    } else {
      this.headDownSince = null;
      if (this.state === "head_down") {
        this.state = "focused";
        events.push({ type: "head_down_end", at: timestamp });
      }
    }

    return { state: this.state, events };
  }

  reset(): void {
    this.state = "initializing";
    this.noFaceSince = null;
    this.headDownSince = null;
  }
}
