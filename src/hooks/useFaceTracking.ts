"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_CONSTRAINTS, FaceTracker } from "@/lib/vision/faceTracker";
import type { FaceSignal, TrackerStats } from "@/lib/vision/types";

export type TrackingStatus = "idle" | "loading" | "running" | "error";

/** UI 텍스트 갱신 주기 — 신호 자체는 ref로 60fps 흐르고, React 리렌더는 이 주기로만 */
const UI_UPDATE_INTERVAL_MS = 200;

export interface UseFaceTrackingResult {
  /** 숨김 <video>에 연결할 ref (카메라 프리뷰 원본) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 최신 신호 — 캔버스 등 고주기 소비자는 이걸 rAF로 읽는다 (리렌더 없음) */
  signalRef: React.RefObject<FaceSignal | null>;
  /** 저주기(5Hz) UI 표시용 스냅샷 */
  signal: FaceSignal | null;
  stats: TrackerStats | null;
  status: TrackingStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * 카메라 + FaceTracker 생명주기를 관리하는 훅.
 * 반드시 사용자 제스처(버튼 등)에서 start()를 호출할 것 — iOS 카메라 정책.
 */
export function useFaceTracking(): UseFaceTrackingResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signalRef = useRef<FaceSignal | null>(null);
  const statsRef = useRef<TrackerStats | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const uiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<FaceSignal | null>(null);
  const [stats, setStats] = useState<TrackerStats | null>(null);

  const stop = useCallback(() => {
    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }
    trackerRef.current?.close();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    signalRef.current = null;
    setStatus("idle");
    setSignal(null);
    setStats(null);
  }, []);

  const start = useCallback(async () => {
    if (status === "loading" || status === "running") return;
    setStatus("loading");
    setError(null);
    try {
      // 모델 로딩과 카메라 권한 요청을 병렬로
      const [tracker, stream] = await Promise.all([
        FaceTracker.create(),
        navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS),
      ]);
      const video = videoRef.current;
      if (!video) throw new Error("video element가 마운트되지 않음");
      video.srcObject = stream;
      await video.play();

      trackerRef.current = tracker;
      streamRef.current = stream;
      tracker.start(video, (s, st) => {
        signalRef.current = s;
        statsRef.current = st;
      });

      // 세션 중 화면 꺼짐 방지 (지원 브라우저에서만)
      try {
        wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // 미지원/거부 — 치명적이지 않음
      }

      uiTimerRef.current = setInterval(() => {
        setSignal(signalRef.current);
        setStats(statsRef.current);
      }, UI_UPDATE_INTERVAL_MS);
      setStatus("running");
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [status, stop]);

  // 언마운트 시 자원 해제
  useEffect(() => stop, [stop]);

  return { videoRef, signalRef, signal, stats, status, error, start, stop };
}
