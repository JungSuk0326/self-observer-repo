"use client";

import { formatClock, formatDuration } from "@/lib/format";
import type { SessionSummary } from "@/lib/session/types";

interface SummaryCardProps {
  summary: SessionSummary;
  onClose: () => void;
}

/**
 * 세션 종료 요약 (G-1의 기본형).
 * 히스토리 저장(G-2)은 다음 단계 — 지금은 이번 세션 결과만 보여준다.
 */
export default function SummaryCard({ summary, onClose }: SummaryCardProps) {
  const rows: { label: string; value: string; className?: string }[] = [
    { label: "집중", value: formatClock(summary.focusedMs), className: "text-emerald-400" },
    { label: "이탈", value: formatClock(summary.distractedMs), className: "text-red-400" },
    { label: "휴식", value: formatClock(summary.pausedMs) },
    {
      label: "자리비움 / 고개숙임 / 시선이탈",
      value: `${summary.awayCount} / ${summary.headDownCount} / ${summary.lookAwayCount}회`,
    },
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-gray-800 bg-surface p-6">
        <p className="text-sm text-muted">이번 세션</p>
        <p className="mb-1 text-3xl font-bold tabular-nums">
          {formatDuration(summary.elapsedMs)}
        </p>
        <p className="mb-5 text-sm text-muted">
          {summary.goalDurationMs === null
            ? "자유 모드"
            : summary.goalReached
              ? "목표 달성 🎉"
              : `목표 ${formatDuration(summary.goalDurationMs)} 중`}
        </p>

        <dl className="space-y-2 text-sm tabular-nums">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between">
              <dt className="text-muted">{r.label}</dt>
              <dd className={r.className}>{r.value}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-800 pt-2.5 text-base font-bold">
            <dt>집중률</dt>
            <dd>{Math.round(summary.focusRatio * 100)}%</dd>
          </div>
        </dl>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-blue-600 py-3.5 font-bold transition-colors hover:bg-blue-500"
        >
          확인
        </button>
      </div>
    </div>
  );
}
