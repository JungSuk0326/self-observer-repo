"use client";

import { useState } from "react";
import AvatarCanvas from "@/components/AvatarCanvas";
import { useFaceTracking } from "@/hooks/useFaceTracking";

/**
 * 비전 파이프라인 검증 페이지 (개발용).
 * 폰: npm run dev + cloudflared tunnel로 HTTPS 접속 후 확인.
 */
export default function VisionDevPage() {
  const { videoRef, signalRef, signal, stats, status, error, start, stop } =
    useFaceTracking();
  const [showRaw, setShowRaw] = useState(false);

  const fps = stats?.fps ?? 0;
  const fpsColor =
    fps >= 15 ? "text-emerald-400" : fps >= 10 ? "text-amber-400" : "text-red-400";

  return (
    <main className="relative flex h-dvh flex-col bg-[#0f1115] text-gray-100">
      <AvatarCanvas signalRef={signalRef} className="min-h-0 w-full flex-1" />

      {/* 원본 미니뷰 (마스킹 비교용, 기본 숨김) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute bottom-28 left-2 z-10 w-24 rounded-lg transition-opacity ${
          showRaw ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* 상태/통계 패널 */}
      {status === "running" && (
        <div className="absolute right-2 top-2 z-10 rounded-xl border border-gray-700 bg-black/70 px-3 py-2 text-xs leading-relaxed tabular-nums">
          <span className={`text-xl font-bold ${fpsColor}`}>{fps.toFixed(0)}</span>{" "}
          <span className="text-gray-400">FPS</span>
          <br />
          추론 {(stats?.inferMs ?? 0).toFixed(1)} ms
          <br />
          <span className="text-gray-400">pitch</span>{" "}
          {(signal?.pose.pitch ?? 0).toFixed(0)}°{" "}
          <span className="text-gray-400">yaw</span>{" "}
          {(signal?.pose.yaw ?? 0).toFixed(0)}°
          <br />
          <span className="text-gray-400">
            {signal?.present ? "얼굴 검출됨" : "얼굴 없음"}
          </span>
        </div>
      )}

      {/* 컨트롤 */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {status === "running" ? (
          <>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="flex-1 rounded-xl bg-gray-700 py-3.5 font-bold"
            >
              {showRaw ? "원본 숨기기" : "원본 보기"}
            </button>
            <button onClick={stop} className="flex-1 rounded-xl bg-gray-700 py-3.5 font-bold">
              종료
            </button>
          </>
        ) : (
          <button
            onClick={start}
            disabled={status === "loading"}
            className="flex-1 rounded-xl bg-blue-600 py-3.5 font-bold disabled:opacity-50"
          >
            {status === "loading" ? "모델 로딩 중…" : "카메라 시작"}
          </button>
        )}
      </div>

      {error && (
        <p className="absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-lg bg-red-900/90 px-3 py-1.5 text-sm">
          오류: {error}
        </p>
      )}
    </main>
  );
}
