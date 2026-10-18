"use client";

import { formatDuration } from "@/lib/format";
import { gradeFor, recentDays, streakDays } from "@/lib/history/stats";
import type { SessionRecord } from "@/lib/history/types";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

interface HistorySheetProps {
  records: SessionRecord[];
  /** 벽시계 현재 시각 — 렌더 중 Date.now()를 부르지 않도록 호출부가 넘긴다 */
  now: number;
  onClose: () => void;
}

/** 세션 히스토리 (G-2) — 최근 7일 막대 + 최근 세션 목록. 전부 이 기기 기록이다 */
export default function HistorySheet({ records, now, onClose }: HistorySheetProps) {
  const days = recentDays(records, now, 7);
  const max = Math.max(1, ...days.map((d) => d.focusMs));
  const recent = [...records].reverse().slice(0, 10);
  const total = records.reduce((s, r) => s + r.focusedMs, 0);

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-gray-800 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">내 기록</h2>
          <button onClick={onClose} className="text-sm text-muted underline">
            닫기
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-xl font-bold">🔥 {streakDays(records, now)}</p>
            <p className="text-xs text-muted">일 연속</p>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-xl font-bold">{records.length}</p>
            <p className="text-xs text-muted">세션</p>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-xl font-bold">{formatDuration(total)}</p>
            <p className="text-xs text-muted">총 집중</p>
          </div>
        </div>

        <p className="mb-2 text-sm font-semibold">최근 7일</p>
        <div className="mb-5 flex h-28 gap-2 rounded-2xl bg-surface p-3">
          {days.map((d) => {
            const date = new Date(`${d.key}T12:00:00`);
            return (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-md ${d.isToday ? "bg-blue-500" : "bg-emerald-600"}`}
                    style={{ height: `${Math.max(d.focusMs > 0 ? 6 : 2, (d.focusMs / max) * 100)}%` }}
                    title={formatDuration(d.focusMs)}
                  />
                </div>
                <span className={`text-[10px] ${d.isToday ? "font-bold text-foreground" : "text-muted"}`}>
                  {WEEKDAY[date.getDay()]}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mb-2 text-sm font-semibold">최근 세션</p>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted">
            아직 기록이 없어요. 첫 세션을 시작해 보세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-2xl bg-surface">
            {recent.map((r) => {
              const d = new Date(r.endedAtWall);
              const grade = gradeFor(r);
              return (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-muted tabular-nums">
                    {d.getMonth() + 1}/{d.getDate()} ({WEEKDAY[d.getDay()]}){" "}
                    {String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {formatDuration(r.focusedMs)}
                    <span className="w-5 text-center font-bold">{grade ?? "·"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-center text-xs text-muted">기록은 이 기기에만 저장됩니다.</p>
      </div>
    </div>
  );
}
