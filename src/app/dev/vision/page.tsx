"use client";

import { useEffect, useRef, useState } from "react";
import AvatarCanvas from "@/components/AvatarCanvas";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { DetectionEngine } from "@/lib/detection/detectionEngine";
import type { FocusState } from "@/lib/detection/types";

const STATE_BANNER: Record<FocusState, { label: string; className: string }> = {
  initializing: { label: "⚪ 얼굴 찾는 중…", className: "bg-gray-700/90" },
  focused: { label: "🟢 집중 감지 중", className: "bg-emerald-700/90" },
  away: { label: "🔴 부재 감지 — 자리를 비웠어요", className: "bg-red-700/90" },
  head_down: { label: "🟠 고개 숙임 지속 — 졸리신가요?", className: "bg-amber-600/90" },
};

/**
 * 비전 파이프라인 검증 페이지 (개발용).
 * 폰: npm run dev + cloudflared tunnel로 HTTPS 접속 후 확인.
 */
export default function VisionDevPage() {
  const { videoRef, signalRef, signal, stats, status, error, start, stop } =
    useFaceTracking();
  const [showRaw, setShowRaw] = useState(false);
  const engineRef = useRef(new DetectionEngine());
  const [focusState, setFocusState] = useState<FocusState>("initializing");

  // 5Hz로 신호를 읽어 감지 엔진에 공급 → 상태 배너 갱신
  useEffect(() => {
    if (status !== "running") return;
    const engine = engineRef.current;
    const timer = setInterval(() => {
      const s = signalRef.current;
      if (!s) return;
      const { state } = engine.update({
        present: s.present,
        pitch: s.pose.pitch,
        timestamp: s.timestamp,
      });
      setFocusState(state);
    }, 200);
    return () => {
      clearInterval(timer);
      engine.reset();
      setFocusState("initializing");
    };
  }, [status, signalRef]);

  const fps = stats?.fps ?? 0;
  const fpsColor =
    fps >= 15 ? "text-emerald-400" : fps >= 10 ? "text-amber-400" : "text-red-400";

  return (
    <main className="relative flex h-dvh flex-col bg-[#0f1115] text-gray-100">
      <AvatarCanvas signalRef={signalRef} className="min-h-0 w-full flex-1" />

      {/* 감지 상태 배너 */}
      {status === "running" && (
        <div
          className={`absolute inset-x-0 top-0 z-10 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-sm font-semibold transition-colors ${STATE_BANNER[focusState].className}`}
        >
          {STATE_BANNER[focusState].label}
        </div>
      )}

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
        <div className="absolute right-2 top-14 z-10 rounded-xl border border-gray-700 bg-black/70 px-3 py-2 text-xs leading-relaxed tabular-nums">
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
