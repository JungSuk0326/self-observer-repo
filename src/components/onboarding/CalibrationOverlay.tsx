"use client";

interface CalibrationOverlayProps {
  /** 0~1. null이면 아직 시작 전 안내 화면 */
  progress: number | null;
  onStart: () => void;
  onSkip: () => void;
}

/**
 * 캘리브레이션 (B-2, UC-1 #4~5).
 *
 * 사람마다 카메라 각도와 앉은 자세가 달라 절대 각도로는 고개 숙임을 오탐한다.
 * 평소 자세를 기준점으로 저장해야 오탐이 줄어든다.
 * 건너뛰기를 허용하는 이유: 기본 임계값으로도 동작하고, 여기서 막히면
 * 첫 세션에 도달하지 못한다.
 */
export default function CalibrationOverlay({
  progress,
  onStart,
  onSkip,
}: CalibrationOverlayProps) {
  if (progress !== null) {
    const percent = Math.round(progress * 100);
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/75 p-8 text-center">
        <p className="text-xl font-bold">카메라를 정면으로 바라봐 주세요</p>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-60 overflow-hidden rounded-full bg-gray-700"
        >
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-muted">
          평소 공부하는 자세를 기준으로 저장합니다 ({percent}%)
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-gray-800 bg-background/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
      <h2 className="mb-1 text-lg font-bold">기준 자세를 맞춰 볼까요?</h2>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        평소 공부하는 자세로 앉아 3초만 카메라를 바라보면, 그 자세를 기준으로 고개
        숙임을 판단합니다. 스트레칭을 졸음으로 오해하지 않게 하는 단계입니다.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold transition-colors hover:bg-blue-500"
        >
          3초 맞추기 시작
        </button>
        <button onClick={onSkip} className="text-sm text-muted underline">
          건너뛰고 기본값으로 시작
        </button>
      </div>
    </div>
  );
}
