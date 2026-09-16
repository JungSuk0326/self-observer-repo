"use client";

import type { MessageTone, SupervisorMessage } from "@/lib/message/types";

const STYLE: Record<MessageTone, string> = {
  warn: "border-amber-500/60 bg-amber-950/90",
  encourage: "border-emerald-500/60 bg-emerald-950/90",
  info: "border-sky-500/60 bg-sky-950/90",
};

const ICON: Record<MessageTone, string> = {
  warn: "🔔",
  encourage: "💚",
  info: "💬",
};

interface MessageToastProps {
  message: SupervisorMessage;
}

/** 감독관 메시지 표시 (D-5) */
export default function MessageToast({ message }: MessageToastProps) {
  return (
    <div
      role="status"
      className={`absolute inset-x-3 top-32 z-20 mx-auto max-w-sm rounded-2xl border px-4 py-3.5 text-sm font-medium leading-relaxed shadow-lg ${STYLE[message.tone]}`}
    >
      <span className="mr-1.5">{ICON[message.tone]}</span>
      {message.text}
    </div>
  );
}
