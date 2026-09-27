/**
 * 아바타 프리셋 (B-1).
 *
 * 두 종류의 렌더러가 있다:
 * - "vrm": VRoid로 만든 3D 아바타(VRM 1.0). 머리 자세는 뼈 회전, 표정은 VRM 표정 프리셋으로.
 *   기본값. 파일은 public/avatars/ 아래 (scripts/slim-vrm.py로 경량화한 것만 둔다).
 * - "canvas": 파라미터 구동 2D 캔버스 — 저사양·발열 대안. 새 캐릭터 = 항목 추가.
 * 코스메틱(H-1~)은 이 구조를 확장해서 붙는다.
 */
interface AvatarPresetBase {
  id: string;
  name: string;
  /** 선택 UI 표시용 */
  emoji: string;
}

export interface VrmAvatarPreset extends AvatarPresetBase {
  kind: "vrm";
  /** public/ 기준 경로. basePath는 렌더러가 붙인다 */
  path: string;
}

export interface CanvasAvatarPreset extends AvatarPresetBase {
  kind: "canvas";
  /** 얼굴 바탕색 */
  skin: string;
  /** 귀 안쪽/포인트 색 */
  earInner: string;
  earShape: "round" | "pointy" | "long";
  eye: string;
  brow: string;
  mouth: string;
  /** 볼터치 색 (없으면 생략) */
  blush?: string;
  whiskers?: boolean;
}

export type AvatarPreset = VrmAvatarPreset | CanvasAvatarPreset;

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "study",
    kind: "vrm",
    name: "스터디",
    emoji: "🧑‍🎓",
    path: "/avatars/study.vrm",
  },
  {
    id: "bear",
    kind: "canvas",
    name: "베어",
    emoji: "🐻",
    skin: "#c98f5a",
    earInner: "#8a5a30",
    earShape: "round",
    eye: "#22262f",
    brow: "#6f4522",
    mouth: "#7a3d2e",
    blush: "#b06a3f",
  },
  {
    id: "cat",
    kind: "canvas",
    name: "캣",
    emoji: "🐱",
    skin: "#9aa3b2",
    earInner: "#e7a0b0",
    earShape: "pointy",
    eye: "#1d2410",
    brow: "#5d6675",
    mouth: "#7d4a56",
    whiskers: true,
  },
  {
    id: "bunny",
    kind: "canvas",
    name: "버니",
    emoji: "🐰",
    skin: "#efe6dc",
    earInner: "#f3b8c4",
    earShape: "long",
    eye: "#2a2530",
    brow: "#b09a86",
    mouth: "#c96a7a",
    blush: "#f0b9b0",
  },
];

export const DEFAULT_PRESET = AVATAR_PRESETS[0];

export function getPresetById(id: string | null | undefined): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}
