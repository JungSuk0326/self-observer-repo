"use client";

import { formatDuration, formatGoalMinutes } from "@/lib/format";
import { PERSONAS } from "@/lib/message/personas";

/** 목표 시간 선택지(분). null은 자유 모드(스톱워치) */
const GOAL_OPTIONS: (number | null)[] = [25, 50, 90, null];

interface ReadyPanelProps {
  goalMinutes: number | null;
  onGoalChange: (minutes: number | null) => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  personaId: string;
  onPersonaChange: (id: string) => void;
  streakDays: number;
  todayFocusMs: number;
  onOpenHistory: () => void;
  calibrated: boolean;
  onChangeAvatar: () => void;
  onRecalibrate: () => void;
  onStart: () => void;
}

/**
 * 세션 시작 준비 화면 (UC-1 #5~6, C-2).
 * 마스킹된 자기 모습을 확인한 상태에서 목표 시간만 고르고 바로 시작한다.
 */
export default function ReadyPanel({
  goalMinutes,
  onGoalChange,
  voiceOn,
  onToggleVoice,
  personaId,
  onPersonaChange,
  streakDays,
  todayFocusMs,
  onOpenHistory,
  calibrated,
  onChangeAvatar,
  onRecalibrate,
  onStart,
}: ReadyPanelProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-gray-800 bg-background/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">준비됐습니다</h2>
        <button
          onClick={onOpenHistory}
          className="rounded-full border border-gray-700 bg-surface px-3 py-1 text-xs font-semibold"
        >
          🔥 {streakDays}일 · 오늘 {todayFocusMs > 0 ? formatDuration(todayFocusMs) : "아직"} · 기록
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">
        얼마나 집중할까요? 목표 없이 스톱워치로만 재도 됩니다.
      </p>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {GOAL_OPTIONS.map((opt) => {
          const selected = opt === goalMinutes;
          return (
            <button
              key={opt ?? "free"}
              onClick={() => onGoalChange(opt)}
              aria-pressed={selected}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                selected
                  ? "border-blue-500 bg-blue-500/15"
                  : "border-gray-800 bg-surface"
              }`}
            >
              {formatGoalMinutes(opt)}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-sm font-semibold">감독관</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {PERSONAS.map((p) => {
          const selected = p.id === personaId;
          return (
            <button
              key={p.id}
              onClick={() => onPersonaChange(p.id)}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2.5 transition-colors ${
                selected ? "border-blue-500 bg-blue-500/15" : "border-gray-800 bg-surface"
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-xs font-semibold">{p.name}</span>
              <span className="text-[10px] leading-tight text-muted">{p.tagline}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-semibold">감독관 음성 안내</p>
          <p className="text-xs text-muted">
            {voiceOn ? "메시지를 소리로도 읽어 줍니다" : "메시지를 화면에만 띄웁니다"}
          </p>
        </div>
        <button
          onClick={onToggleVoice}
          aria-label="음성 안내"
          aria-pressed={voiceOn}
          className={`rounded-full px-4 py-2 text-lg transition-colors ${
            voiceOn ? "bg-emerald-700" : "bg-gray-700"
          }`}
        >
          {voiceOn ? "🔊" : "🔇"}
        </button>
      </div>

      <button
        onClick={onStart}
        className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold transition-colors hover:bg-blue-500"
      >
        집중 시작
      </button>

      <div className="mt-3 flex justify-center gap-5 text-sm text-muted">
        <button onClick={onChangeAvatar} className="underline">
          아바타 변경
        </button>
        <button onClick={onRecalibrate} className="underline">
          {calibrated ? "기준 자세 다시 맞추기" : "기준 자세 맞추기"}
        </button>
      </div>
    </div>
  );
}
