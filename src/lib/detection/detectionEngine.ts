import type { HandSignal } from "@/lib/vision/types";
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
  /**
   * 습관 신호 — 집중 상태와 별개다. 코 파기는 집중 이탈이 아니라 습관이라
   * 이탈 시간에 넣지 않고, 이벤트로만 알린다.
   */
  nosePicking: boolean;
}

/**
 * 부재/고개숙임/시선이탈 판정 상태 머신 (D-1, D-2, D-3, D-4).
 *
 * 순수 로직 — DOM/시간/React 의존 없음. 시간은 입력 timestamp로만 흐르므로
 * 단위 테스트에서 임의로 시간을 진행시킬 수 있다.
 *
 * 오탐 방지 설계(아키텍처 원칙 4):
 * - 모든 판정은 "임계값 초과가 delay만큼 지속"되어야 확정된다.
 *   잠깐의 스트레칭·고개 돌림·프레임 드랍은 상태를 바꾸지 않는다.
 * - 복귀(얼굴 재검출, 정면 복귀, 고개 들기)는 즉시 반영한다 —
 *   돌아온 사용자를 기다리게 하는 것이 더 나쁜 경험.
 *
 * 시선 이탈과 부재의 구분:
 * - 얼굴 모델은 정면 ±45° 근처에서 추적이 끊긴다. 옆을 보던 중 얼굴이 사라지면
 *   "아직 옆을 보고 있다"로 해석해 시선 이탈 타이머를 이어 가고, 부재 판정은
 *   더 긴 지연(turnedAbsenceDelayMs)을 둔다. 정면에서 사라진 얼굴은 기존대로
 *   짧은 지연(absenceDelayMs) 뒤 부재다.
 * - yaw가 클 때는 pitch 추정이 불안정하므로 고개 숙임을 판정하지 않는다.
 *
 * 손 딴짓 (손 랜드마커가 있을 때만):
 * - 폰 들기: 손이 얼굴 아래 앞에 떠 있고(가까워서 크게 보임) 고개가 적당히 숙여진 채
 *   지속. 필기하는 손은 더 아래·더 작고 고개가 더 숙여지므로 구역·각도 범위로 거른다.
 *   집중 이탈이므로 FocusState("phone")다. 고개 숙임보다 우선한다(더 구체적인 설명).
 * - 코 파기: 손가락 끝이 코끝에 붙은 채 지속. 집중 이탈이 아니라 습관이라 상태를
 *   바꾸지 않고 nose_pick_start/end 이벤트와 결과의 nosePicking으로만 알린다.
 *
 * 이벤트 규약: 이탈 상태(away/head_down/looking_away/phone) 사이의 직접 전이는
 * 새 상태의 *_start만 낸다. *_end는 focused로 돌아올 때만 낸다.
 */
export class DetectionEngine {
  private readonly config: DetectionConfig;
  private state: FocusState = "initializing";
  private noFaceSince: number | null = null;
  private headDownSince: number | null = null;
  private yawSince: number | null = null;
  /** 마지막으로 얼굴이 보였을 때의 yaw — 놓친 순간 "옆을 보고 있었나"의 근거 */
  private lastYaw = 0;
  private turnedBeforeLoss = false;
  private phoneSince: number | null = null;
  private noseSince: number | null = null;
  private nosePicking = false;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
  }

  get currentState(): FocusState {
    return this.state;
  }

  update(input: DetectionInput): DetectionResult {
    const { present, pitch, yaw, timestamp } = input;
    const hand = input.hand ?? null;
    const events: DetectionEvent[] = [];
    const c = this.config;
    const result = () => ({ state: this.state, events, nosePicking: this.nosePicking });

    // 첫 얼굴 검출 전에는 판정하지 않는다 (카메라 준비 중 오탐 방지)
    if (this.state === "initializing") {
      if (present) this.state = "focused";
      return result();
    }

    if (!present) {
      this.headDownSince = null;
      this.phoneSince = null;
      this.endNosePick(events, timestamp);
      if (this.noFaceSince === null) {
        this.noFaceSince = timestamp;
        this.turnedBeforeLoss = Math.abs(this.lastYaw) >= c.lookAwayYawDeg;
      }

      if (this.turnedBeforeLoss) {
        // 옆을 보던 중 놓침 — 시선 이탈 타이머는 계속 흐른다
        this.yawSince ??= timestamp;
        if (
          this.state !== "looking_away" &&
          this.state !== "away" &&
          timestamp - this.yawSince >= c.lookAwayDelayMs
        ) {
          this.state = "looking_away";
          events.push({ type: "look_away_start", at: timestamp });
        }
        if (this.state !== "away" && timestamp - this.noFaceSince >= c.turnedAbsenceDelayMs) {
          this.state = "away";
          events.push({ type: "absence_start", at: timestamp });
        }
      } else {
        this.yawSince = null;
        if (this.state !== "away" && timestamp - this.noFaceSince >= c.absenceDelayMs) {
          this.state = "away";
          events.push({ type: "absence_start", at: timestamp });
        }
      }
      return result();
    }

    // 얼굴 있음 — 부재였다면 즉시 복귀
    this.lastYaw = yaw;
    this.noFaceSince = null;
    this.turnedBeforeLoss = false;
    if (this.state === "away") {
      this.state = "focused";
      events.push({ type: "absence_end", at: timestamp });
    }

    // 코 파기 (습관) — 집중 상태와 독립으로 판정
    this.updateNosePick(hand, timestamp, events);

    // 시선 이탈 판정 (yaw). 큰 yaw에서는 pitch를 믿지 않으므로 고개 숙임은 보류
    if (Math.abs(yaw) >= c.lookAwayYawDeg) {
      this.headDownSince = null;
      this.phoneSince = null;
      this.yawSince ??= timestamp;
      if (this.state !== "looking_away" && timestamp - this.yawSince >= c.lookAwayDelayMs) {
        this.state = "looking_away";
        events.push({ type: "look_away_start", at: timestamp });
      }
      return result();
    }
    this.yawSince = null;
    if (this.state === "looking_away") {
      this.state = "focused";
      events.push({ type: "look_away_end", at: timestamp });
    }

    // 폰 들기 — 손이 얼굴 아래 앞에 떠 있고 고개가 숙여진 채 지속. 고개 숙임보다 먼저 본다
    const inPhonePose =
      hand?.present === true &&
      hand.offsetY >= c.phoneZoneYMin &&
      hand.offsetY <= c.phoneZoneYMax &&
      Math.abs(hand.offsetX) <= c.phoneZoneXMax &&
      hand.size >= c.phoneHandSizeMin &&
      pitch >= c.phonePitchMinDeg &&
      pitch <= c.phonePitchMaxDeg;
    if (inPhonePose) {
      this.phoneSince ??= timestamp;
      if (this.state !== "phone" && timestamp - this.phoneSince >= c.phoneDelayMs) {
        this.state = "phone";
        this.headDownSince = null;
        events.push({ type: "phone_start", at: timestamp });
      }
      if (this.state === "phone") return result();
    } else {
      this.phoneSince = null;
      if (this.state === "phone") {
        this.state = "focused";
        events.push({ type: "phone_end", at: timestamp });
      }
    }

    // 고개 숙임 판정 (얼굴이 정면 근처일 때만)
    if (Math.abs(pitch) >= c.headDownPitchDeg) {
      this.headDownSince ??= timestamp;
      if (this.state !== "head_down" && timestamp - this.headDownSince >= c.headDownDelayMs) {
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

    return result();
  }

  private updateNosePick(hand: HandSignal | null, timestamp: number, events: DetectionEvent[]): void {
    const touching = hand?.present === true && hand.fingerToNose <= this.config.nosePickDistance;
    if (!touching) {
      this.noseSince = null;
      this.endNosePick(events, timestamp);
      return;
    }
    this.noseSince ??= timestamp;
    if (!this.nosePicking && timestamp - this.noseSince >= this.config.nosePickDelayMs) {
      this.nosePicking = true;
      events.push({ type: "nose_pick_start", at: timestamp });
    }
  }

  private endNosePick(events: DetectionEvent[], timestamp: number): void {
    if (this.nosePicking) {
      this.nosePicking = false;
      events.push({ type: "nose_pick_end", at: timestamp });
    }
  }

  reset(): void {
    this.state = "initializing";
    this.noFaceSince = null;
    this.headDownSince = null;
    this.yawSince = null;
    this.lastYaw = 0;
    this.turnedBeforeLoss = false;
    this.phoneSince = null;
    this.noseSince = null;
    this.nosePicking = false;
  }
}
