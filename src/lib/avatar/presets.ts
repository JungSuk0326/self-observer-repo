/**
 * 아바타 프리셋 (B-1).
 * 렌더링은 전부 파라미터 구동 — 새 캐릭터 추가 = 이 파일에 항목 추가.
 * 코스메틱(H-1~)도 이 구조를 확장해서 붙는다 (귀/색/장식 = 팔릴 수 있는 슬롯).
 */
export interface AvatarPreset {
  id: string;
  name: string;
  /** 선택 UI 표시용 */
  emoji: string;
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

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "bear",
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
