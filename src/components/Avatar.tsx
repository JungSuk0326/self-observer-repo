"use client";

import dynamic from "next/dynamic";
import AvatarCanvas from "@/components/AvatarCanvas";

// Three.js(+three-vrm)는 850KB 청크 — 3D 프리셋을 실제로 그릴 때만 내려받는다
const VrmAvatar = dynamic(() => import("@/components/VrmAvatar"), { ssr: false });
import type { AvatarPreset } from "@/lib/avatar/presets";
import type { FocusState } from "@/lib/detection/types";
import type { FaceSignal } from "@/lib/vision/types";

interface AvatarProps {
  signalRef: React.RefObject<FaceSignal | null>;
  preset: AvatarPreset;
  focusState?: FocusState;
  className?: string;
}

/** 프리셋 종류에 따라 3D(VRM) 또는 2D 캔버스 렌더러를 고른다 */
export default function Avatar({ signalRef, preset, focusState, className }: AvatarProps) {
  if (preset.kind === "vrm") {
    return (
      <VrmAvatar
        signalRef={signalRef}
        path={preset.path}
        focusState={focusState}
        className={className}
      />
    );
  }
  return (
    <AvatarCanvas
      signalRef={signalRef}
      preset={preset}
      focusState={focusState}
      className={className}
    />
  );
}
