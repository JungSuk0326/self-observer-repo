"use client";

import { formatClock, formatDuration } from "@/lib/format";
import type { BestKind, Grade, SessionEvaluation, SessionRecord } from "@/lib/history/types";

const GRADE_STYLE: Record<Grade, string> = {
  S: "from-amber-300 to-yellow-500 text-black",
  A: "from-emerald-400 to-teal-500 text-black",
  B: "from-sky-400 to-blue-500 text-white",
  C: "from-gray-500 to-gray-600 text-white",
};

const GRADE_LINE: Record<Grade, string> = {
  S: "흔들림 없는 집중이었어요",
  A: "아주 좋은 세션이었어요",
  B: "괜찮았어요. 다음엔 한 단계 위로",
  C: "오늘은 몸풀기. 다음이 진짜예요",
};

function bestLabel(kind: BestKind, r: SessionRecord): string {
  switch (kind) {
    case "session_focus":
      return `🏆 세션 최장 집중 ${formatDuration(r.focusedMs)}`;
    case "focus_run":
      return `⏱️ 최장 연속 집중 ${formatDuration(r.longestFocusMs)}`;
    case "day_total":
      return "📅 하루 최고 기록";
  }
}

interface SessionReportProps {
  record: SessionRecord;
  evaluation: SessionEvaluation;
  /** 너무 짧아 기록하지 않은 세션 */
  saved: boolean;
  onClose: () => void;
}

/**
 * 세션 종료 리포트 (G-1). 숫자 표가 아니라 "보상 장면"으로 만든다:
 * 등급, 갱신한 최고 기록, 연속 출석, 어제와 비교. 다시 켤 이유가 여기서 생긴다.
 */
export default function SessionReport({ record, evaluation, saved, onClose }: SessionReportProps) {
  const { grade, newBests, isFirstSession, streakDays, todayFocusMs, yesterdayFocusMs } = evaluation;
  const diff = yesterdayFocusMs === null ? null : todayFocusMs - yesterdayFocusMs;

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "집중", value: formatClock(record.focusedMs), className: "text-emerald-400" },
    { label: "이탈", value: formatClock(record.distractedMs), className: "text-red-400" },
    { label: "휴식", value: formatClock(record.pausedMs) },
    { label: "최장 연속 집중", value: formatClock(record.longestFocusMs) },
    {
      label: "자리비움 · 고개숙임 · 시선이탈 · 폰",
      value: `${record.awayCount} · ${record.headDownCount} · ${record.lookAwayCount} · ${record.phoneCount ?? 0}`,
    },
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/80 p-5">
      <div className="w-full max-w-sm rounded-3xl border border-gray-800 bg-surface p-6">
        <div className="mb-4 flex items-center gap-4">
          {grade ? (
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-4xl font-black ${GRADE_STYLE[grade]}`}
            >
              {grade}
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-700 text-2xl">
              ⏳
            </div>
          )}
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatDuration(record.focusedMs)}</p>
            <p className="text-sm text-muted">
              {grade ? GRADE_LINE[grade] : "5분 이상 하면 등급이 매겨져요"}
            </p>
          </div>
        </div>

        {(newBests.length > 0 || isFirstSession || record.goalReached) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {isFirstSession && (
              <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-semibold">
                🌱 첫 기록
              </span>
            )}
            {record.goalReached && (
              <span className="rounded-full bg-blue-900/60 px-3 py-1 text-xs font-semibold">
                🎯 목표 달성
              </span>
            )}
            {newBests.map((b) => (
              <span key={b} className="rounded-full bg-amber-900/60 px-3 py-1 text-xs font-semibold">
                {bestLabel(b, record)}
              </span>
            ))}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-black/30 p-3">
            <p className="text-2xl font-bold">🔥 {streakDays}</p>
            <p className="text-xs text-muted">일 연속</p>
          </div>
          <div className="rounded-2xl bg-black/30 p-3">
            <p className="text-2xl font-bold tabular-nums">{formatDuration(todayFocusMs)}</p>
            <p className="text-xs text-muted">
              오늘 누적
              {diff !== null &&
                (diff >= 0
                  ? ` · 어제보다 +${formatDuration(diff)}`
                  : ` · 어제 ${formatDuration(yesterdayFocusMs!)}`)}
            </p>
          </div>
        </div>

        <dl className="space-y-1.5 text-sm tabular-nums">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <dt className="text-muted">{r.label}</dt>
              <dd className={r.className}>{r.value}</dd>
            </div>
          ))}
        </dl>

        {!saved && (
          <p className="mt-4 text-center text-xs text-muted">1분 미만 세션은 기록에 남기지 않아요.</p>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-blue-600 py-3.5 font-bold transition-colors hover:bg-blue-500"
        >
          확인
        </button>
      </div>
    </div>
  );
}
