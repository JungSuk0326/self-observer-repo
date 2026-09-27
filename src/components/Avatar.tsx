"use client";

import dynamic from "next/dynamic";
import AvatarCanvas from "@/components/AvatarCanvas";

// Three.js(+three-vrm)는 850KB 청크 — 3D 프리셋을 실제로 그릴 때만 내려받는다
const VrmAvatar = dynamic(() => import("@/components/VrmAvatar"), { ssr: false });
import type { AvatarPreset } from "@/lib/avatar/presets";
import type { FocusState } from "@/lib/detection/types";
import type { FaceSignal } from "@/lib/vision/types";

/**
 * 얼굴을 화면 어디에 둘지. 온보딩 단계는 하단 시트가 화면 아래 절반을 덮으므로
 * "upper"로 얼굴을 위쪽에 두고, 세션 중에는 "center".
 */
export type AvatarAnchor = "center" | "upper";

interface AvatarProps {
  signalRef: React.RefObject<FaceSignal | null>;
  preset: AvatarPreset;
  focusState?: FocusState;
  anchor?: AvatarAnchor;
  className?: string;
}

/** 프리셋 종류에 따라 3D(VRM) 또는 2D 캔버스 렌더러를 고른다 */
export default function Avatar({
  signalRef,
  preset,
  focusState,
  anchor = "center",
  className,
}: AvatarProps) {
  if (preset.kind === "vrm") {
    return (
      <VrmAvatar
        signalRef={signalRef}
        path={preset.path}
        focusState={focusState}
        anchor={anchor}
        className={className}
      />
    );
  }
  return (
    <AvatarCanvas
      signalRef={signalRef}
      preset={preset}
      focusState={focusState}
      anchor={anchor}
      className={className}
    />
  );
}
