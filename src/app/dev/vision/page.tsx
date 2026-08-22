"use client";

import { useEffect, useRef, useState } from "react";
import AvatarCanvas from "@/components/AvatarCanvas";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { DetectionEngine } from "@/lib/detection/detectionEngine";
import type { FocusState } from "@/lib/detection/types";
import { SessionEngine } from "@/lib/session/sessionEngine";
import type { SessionSnapshot, SessionSummary } from "@/lib/session/types";

const STATE_BANNER: Record<FocusState, { label: string; className: string }> = {
  initializing: { label: "⚪ 얼굴 찾는 중…", className: "bg-gray-700/90" },
  focused: { label: "🟢 집중 감지 중", className: "bg-emerald-700/90" },
  away: { label: "🔴 부재 감지 — 자리를 비웠어요", className: "bg-red-700/90" },
  head_down: { label: "🟠 고개 숙임 지속 — 졸리신가요?", className: "bg-amber-600/90" },
};

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * 비전 파이프라인 + 감지/세션 엔진 검증 페이지 (개발용).
 * 폰: npm run dev + cloudflared tunnel로 HTTPS 접속 후 확인.
 */
export default function VisionDevPage() {
  const { videoRef, signalRef, signal, stats, status, error, start, stop } =
    useFaceTracking();
  const [showRaw, setShowRaw] = useState(false);
  const engineRef = useRef(new DetectionEngine());
  const sessionRef = useRef<SessionEngine | null>(null);
  const [focusState, setFocusState] = useState<FocusState>("initializing");
  const [sessionSnap, setSessionSnap] = useState<SessionSnapshot | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  // 5Hz: 신호 → 감지 엔진 → 세션 엔진 → UI 상태
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
      const session = sessionRef.current;
      if (session) {
        session.update(s.timestamp, state);
        setSessionSnap(session.getSnapshot());
      }
    }, 200);
    return () => {
      clearInterval(timer);
      engine.reset();
      setFocusState("initializing");
    };
  }, [status, signalRef]);

  const now = () => signalRef.current?.timestamp ?? performance.now();

  const startSession = () => {
    setSummary(null);
    const session = new SessionEngine(); // 자유 모드 — 목표 시간은 6번(온보딩)에서
    session.start(now());
    sessionRef.current = session;
    setSessionSnap(session.getSnapshot());
  };

  const togglePause = () => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.currentPhase === "running") session.pause(now());
    else if (session.currentPhase === "paused") session.resume(now());
    setSessionSnap(session.getSnapshot());
  };

  const endSession = () => {
    const session = sessionRef.current;
    if (!session) return;
    setSummary(session.end(now()));
    sessionRef.current = null;
    setSessionSnap(null);
  };

  const fps = stats?.fps ?? 0;
  const fpsColor =
    fps >= 15 ? "text-emerald-400" : fps >= 10 ? "text-amber-400" : "text-red-400";
  const inSession = sessionSnap !== null;
  const paused = sessionSnap?.phase === "paused";

  return (
    <main className="relative flex h-dvh flex-col bg-[#0f1115] text-gray-100">
      <AvatarCanvas signalRef={signalRef} className="min-h-0 w-full flex-1" />

      {/* 감지 상태 배너 */}
      {status === "running" && (
        <div
          className={`absolute inset-x-0 top-0 z-10 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-sm font-semibold transition-colors ${
            paused ? "bg-sky-700/90" : STATE_BANNER[focusState].className
          }`}
        >
          {paused ? "⏸ 휴식 중" : STATE_BANNER[focusState].label}
        </div>
      )}

      {/* 세션 타이머 */}
      {inSession && sessionSnap && (
        <div className="absolute left-2 top-14 z-10 rounded-xl border border-gray-700 bg-black/70 px-3 py-2 tabular-nums">
          <div className="text-2xl font-bold">{formatMs(sessionSnap.elapsedMs)}</div>
          <div className="text-xs leading-relaxed text-gray-400">
            집중 {formatMs(sessionSnap.focusedMs)} · 이탈{" "}
            {formatMs(sessionSnap.distractedMs)}
            <br />
            자리비움 {sessionSnap.awayCount}회 · 고개숙임 {sessionSnap.headDownCount}회
          </div>
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

      {/* 통계 패널 */}
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
        </div>
      )}

      {/* 세션 종료 요약 */}
      {summary && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#171a21] p-6">
            <h2 className="mb-4 text-lg font-bold">세션 요약</h2>
            <dl className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-gray-400">총 시간</dt>
                <dd>{formatMs(summary.elapsedMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">집중</dt>
                <dd className="text-emerald-400">{formatMs(summary.focusedMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">이탈</dt>
                <dd className="text-red-400">{formatMs(summary.distractedMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">휴식</dt>
                <dd>{formatMs(summary.pausedMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">자리비움 / 고개숙임</dt>
                <dd>
                  {summary.awayCount}회 / {summary.headDownCount}회
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2 font-bold">
                <dt>집중률</dt>
                <dd>{Math.round(summary.focusRatio * 100)}%</dd>
              </div>
            </dl>
            <button
              onClick={() => setSummary(null)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 컨트롤 */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {status === "running" ? (
          inSession ? (
            <>
              <button
                onClick={togglePause}
                className="flex-1 rounded-xl bg-sky-700 py-3.5 font-bold"
              >
                {paused ? "재개" : "휴식"}
              </button>
              <button
                onClick={endSession}
                className="flex-1 rounded-xl bg-red-700 py-3.5 font-bold"
              >
                세션 종료
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startSession}
                className="flex-[2] rounded-xl bg-blue-600 py-3.5 font-bold"
              >
                집중 세션 시작
              </button>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex-1 rounded-xl bg-gray-700 py-3.5 font-bold"
              >
                {showRaw ? "원본 숨김" : "원본"}
              </button>
              <button
                onClick={stop}
                className="flex-1 rounded-xl bg-gray-700 py-3.5 font-bold"
              >
                종료
              </button>
            </>
          )
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
