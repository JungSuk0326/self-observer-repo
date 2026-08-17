"use client";

import { useEffect, useRef } from "react";
import type { FaceSignal } from "@/lib/vision/types";

/** 렌더 픽셀 수 제한 — GPU/발열 절감 (스파이크 검증값) */
const MAX_DPR = 1.5;

interface AvatarCanvasProps {
  /** useFaceTracking의 signalRef — rAF로 직접 읽어 리렌더 없이 그린다 */
  signalRef: React.RefObject<FaceSignal | null>;
  className?: string;
}

/**
 * FaceSignal → 2D 아바타 렌더링.
 * 임시 아트(스파이크의 노란 얼굴) — 4번 단계에서 프리셋 아바타로 교체 예정.
 * 원본 영상은 절대 이 캔버스에 그리지 않는다 (마스킹 원칙).
 */
export default function AvatarCanvas({ signalRef, className }: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = (canvas.width = canvas.clientWidth * dpr);
      const h = (canvas.height = canvas.clientHeight * dpr);

      ctx.fillStyle = "#171a21";
      ctx.fillRect(0, 0, w, h);

      const signal = signalRef.current;
      if (!signal?.present) {
        ctx.fillStyle = "#3a4152";
        ctx.font = `${w / 16}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("(자리 비움)", w / 2, h / 2);
        return;
      }

      const { pitch, yaw, roll, blinkL, blinkR, jaw, brow, smile } = signal.smoothed;
      const cx = w / 2 + (-yaw / 45) * w * 0.12;
      const cy = h / 2 + (pitch / 45) * h * 0.1;
      const R = Math.min(w, h) * 0.27;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-roll * Math.PI) / 180);

      // 머리
      ctx.fillStyle = "#f5c96b";
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 1.12, 0, 0, 7);
      ctx.fill();
      // 귀 (코스메틱 확장 자리)
      ctx.fillStyle = "#e8a84c";
      ctx.beginPath();
      ctx.ellipse(-R * 0.82, -R * 0.85, R * 0.28, R * 0.34, -0.4, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(R * 0.82, -R * 0.85, R * 0.28, R * 0.34, 0.4, 0, 7);
      ctx.fill();

      // 눈 (깜빡임)
      const eyeY = -R * 0.12;
      const eyeDX = R * 0.38;
      for (const [dx, blink] of [
        [-eyeDX, blinkL],
        [eyeDX, blinkR],
      ] as const) {
        const openness = Math.max(0.06, 1 - blink * 1.15);
        ctx.fillStyle = "#22262f";
        ctx.beginPath();
        ctx.ellipse(dx, eyeY, R * 0.13, R * 0.13 * openness + R * 0.015, 0, 0, 7);
        ctx.fill();
      }
      // 눈썹
      ctx.strokeStyle = "#8a5a24";
      ctx.lineWidth = R * 0.05;
      ctx.lineCap = "round";
      for (const dx of [-eyeDX, eyeDX]) {
        ctx.beginPath();
        ctx.moveTo(dx - R * 0.14, eyeY - R * 0.22 - brow * R * 0.12);
        ctx.lineTo(dx + R * 0.14, eyeY - R * 0.24 - brow * R * 0.14);
        ctx.stroke();
      }
      // 입
      ctx.fillStyle = "#8a3d2e";
      ctx.beginPath();
      ctx.ellipse(
        0,
        R * 0.45 + jaw * R * 0.08,
        R * (0.16 + smile * 0.1),
        R * (0.05 + jaw * 0.28),
        0,
        0,
        7,
      );
      ctx.fill();
      ctx.restore();
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [signalRef]);

  return <canvas ref={canvasRef} className={className} />;
}
