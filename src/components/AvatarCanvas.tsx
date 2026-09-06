"use client";

import { useEffect, useRef } from "react";
import type { FaceSignal } from "@/lib/vision/types";
import { DEFAULT_PRESET, type AvatarPreset } from "@/lib/avatar/presets";

/** 렌더 픽셀 수 제한 — GPU/발열 절감 (스파이크 검증값) */
const MAX_DPR = 1.5;

interface AvatarCanvasProps {
  /** useFaceTracking의 signalRef — rAF로 직접 읽어 리렌더 없이 그린다 */
  signalRef: React.RefObject<FaceSignal | null>;
  preset?: AvatarPreset;
  className?: string;
}

/**
 * FaceSignal + AvatarPreset → 2D 아바타 렌더링 (B-1).
 * 원본 영상은 절대 이 캔버스에 그리지 않는다 (마스킹 원칙).
 * 프리셋을 바꿔도 모션 매핑(머리자세/깜빡임/입)은 동일하다.
 */
export default function AvatarCanvas({
  signalRef,
  preset = DEFAULT_PRESET,
  className,
}: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presetRef = useRef(preset);
  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const p = presetRef.current;
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

      drawEars(ctx, p, R);

      // 머리
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 1.12, 0, 0, 7);
      ctx.fill();

      // 볼터치
      if (p.blush) {
        ctx.fillStyle = p.blush;
        ctx.globalAlpha = 0.55;
        for (const dx of [-R * 0.62, R * 0.62]) {
          ctx.beginPath();
          ctx.ellipse(dx, R * 0.28, R * 0.16, R * 0.1, 0, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 눈 (깜빡임)
      const eyeY = -R * 0.12;
      const eyeDX = R * 0.38;
      for (const [dx, blink] of [
        [-eyeDX, blinkL],
        [eyeDX, blinkR],
      ] as const) {
        const openness = Math.max(0.06, 1 - blink * 1.15);
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.ellipse(dx, eyeY, R * 0.13, R * 0.13 * openness + R * 0.015, 0, 0, 7);
        ctx.fill();
      }

      // 눈썹
      ctx.strokeStyle = p.brow;
      ctx.lineWidth = R * 0.05;
      ctx.lineCap = "round";
      for (const dx of [-eyeDX, eyeDX]) {
        ctx.beginPath();
        ctx.moveTo(dx - R * 0.14, eyeY - R * 0.22 - brow * R * 0.12);
        ctx.lineTo(dx + R * 0.14, eyeY - R * 0.24 - brow * R * 0.14);
        ctx.stroke();
      }

      // 수염
      if (p.whiskers) {
        ctx.strokeStyle = p.brow;
        ctx.lineWidth = R * 0.025;
        for (const side of [-1, 1] as const) {
          for (const [dy, tilt] of [
            [R * 0.28, -0.08],
            [R * 0.38, 0],
            [R * 0.48, 0.08],
          ] as const) {
            ctx.beginPath();
            ctx.moveTo(side * R * 0.55, dy);
            ctx.lineTo(side * R * 1.05, dy + tilt * R * 2);
            ctx.stroke();
          }
        }
      }

      // 입 (jawOpen + smile 반영)
      ctx.fillStyle = p.mouth;
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

function drawEars(ctx: CanvasRenderingContext2D, p: AvatarPreset, R: number): void {
  if (p.earShape === "round") {
    for (const side of [-1, 1] as const) {
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.ellipse(side * R * 0.82, -R * 0.85, R * 0.3, R * 0.34, side * 0.4, 0, 7);
      ctx.fill();
      ctx.fillStyle = p.earInner;
      ctx.beginPath();
      ctx.ellipse(side * R * 0.8, -R * 0.83, R * 0.16, R * 0.18, side * 0.4, 0, 7);
      ctx.fill();
    }
    return;
  }
  if (p.earShape === "pointy") {
    for (const side of [-1, 1] as const) {
      const bx = side * R * 0.62;
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.moveTo(bx - side * R * 0.34, -R * 0.78);
      ctx.lineTo(bx + side * R * 0.38, -R * 1.5);
      ctx.lineTo(bx + side * R * 0.46, -R * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.earInner;
      ctx.beginPath();
      ctx.moveTo(bx - side * R * 0.12, -R * 0.82);
      ctx.lineTo(bx + side * R * 0.3, -R * 1.32);
      ctx.lineTo(bx + side * R * 0.34, -R * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // long (토끼)
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.ellipse(side * R * 0.45, -R * 1.35, R * 0.2, R * 0.62, side * 0.12, 0, 7);
    ctx.fill();
    ctx.fillStyle = p.earInner;
    ctx.beginPath();
    ctx.ellipse(side * R * 0.45, -R * 1.32, R * 0.1, R * 0.45, side * 0.12, 0, 7);
    ctx.fill();
  }
}
