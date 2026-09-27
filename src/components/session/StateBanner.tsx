"use client";

import type { FocusState } from "@/lib/detection/types";

const BANNER: Record<FocusState, { label: string; className: string }> = {
  initializing: { label: "⚪ 얼굴 찾는 중…", className: "bg-gray-700/90" },
  focused: { label: "🟢 감독관이 지켜보고 있어요", className: "bg-emerald-700/90" },
  away: { label: "🔴 자리를 비우셨어요", className: "bg-red-700/90" },
  head_down: { label: "🟠 고개가 오래 숙여져 있어요", className: "bg-amber-600/90" },
  looking_away: { label: "🟡 시선이 화면 밖에 있어요", className: "bg-yellow-600/90" },
};

interface StateBannerProps {
  focusState: FocusState;
  paused: boolean;
}

/** 현재 감지 상태 표시 (C-3) — 거치한 폰이 감독관처럼 보이게 하는 장치 */
export default function StateBanner({ focusState, paused }: StateBannerProps) {
  const banner = BANNER[focusState];
  return (
    <div
      role="status"
      className={`absolute inset-x-0 top-0 z-10 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-sm font-semibold transition-colors ${
        paused ? "bg-sky-700/90" : banner.className
      }`}
    >
      {paused ? "⏸ 휴식 중" : banner.label}
    </div>
  );
}
