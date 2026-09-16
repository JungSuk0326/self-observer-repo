"use client";

import { AVATAR_PRESETS } from "@/lib/avatar/presets";

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}

/**
 * 아바타 프리셋 선택 (B-1, UC-1 #3~4).
 * 뒤에서 아바타가 이미 내 얼굴을 따라 움직이고 있으므로, 이 시트는 선택만 맡는다.
 * 고르는 즉시 배경 아바타가 바뀌어 "이게 내 모습"임을 바로 확인할 수 있다.
 */
export default function AvatarPicker({
  selectedId,
  onSelect,
  onConfirm,
}: AvatarPickerProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-gray-800 bg-background/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
      <h2 className="mb-1 text-lg font-bold">어떤 얼굴로 공부할까요?</h2>
      <p className="mb-4 text-sm text-muted">
        고른 아바타가 지금 화면에서 바로 움직입니다. 나중에 바꿀 수 있습니다.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {AVATAR_PRESETS.map((p) => {
          const selected = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 transition-colors ${
                selected
                  ? "border-blue-500 bg-blue-500/15"
                  : "border-gray-800 bg-surface"
              }`}
            >
              <span className="text-3xl">{p.emoji}</span>
              <span className="text-sm font-semibold">{p.name}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onConfirm}
        className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold transition-colors hover:bg-blue-500"
      >
        이 아바타로 계속
      </button>
    </div>
  );
}
