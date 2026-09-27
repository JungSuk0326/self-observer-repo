"use client";

import { formatClock } from "@/lib/format";
import type { SessionSnapshot } from "@/lib/session/types";

interface SessionHudProps {
  snapshot: SessionSnapshot;
}

/** 진행 중 집계 표시 (C-2, C-3) */
export default function SessionHud({ snapshot }: SessionHudProps) {
  return (
    <div className="absolute left-2 top-14 z-10 rounded-2xl border border-gray-800 bg-black/70 px-3.5 py-2.5 tabular-nums">
      <div className="text-3xl font-bold">{formatClock(snapshot.elapsedMs)}</div>
      {snapshot.remainingMs !== null && (
        <div className="text-xs text-blue-300">
          {snapshot.goalReached
            ? "목표 달성 🎉"
            : `목표까지 ${formatClock(snapshot.remainingMs)}`}
        </div>
      )}
      <div className="mt-1 text-xs leading-relaxed text-muted">
        집중 {formatClock(snapshot.focusedMs)} · 이탈{" "}
        {formatClock(snapshot.distractedMs)}
        <br />
        자리비움 {snapshot.awayCount} · 고개숙임 {snapshot.headDownCount} · 시선이탈{" "}
        {snapshot.lookAwayCount}
      </div>
    </div>
  );
}
