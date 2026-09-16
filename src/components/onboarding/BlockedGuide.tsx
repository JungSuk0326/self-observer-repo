"use client";

import Link from "next/link";
import type { CameraFailure } from "@/lib/vision/cameraError";

interface BlockedGuideProps {
  failure: CameraFailure;
  /** 세션 중 끊긴 경우 — 안내 문구가 달라진다 */
  duringSession: boolean;
  onRetry: () => void;
}

/**
 * 카메라를 쓸 수 없을 때의 대체 흐름 (UC-1 대체 흐름).
 * 원인별로 사용자가 할 수 있는 조치가 완전히 다르므로 문구를 분리한다.
 * "권한이 거부되었습니다" 한 줄로 끝내면 대부분 그대로 이탈한다.
 */
const GUIDE: Record<CameraFailure, { title: string; steps: string[] }> = {
  denied: {
    title: "카메라 권한이 거부되어 있습니다",
    steps: [
      "주소창의 자물쇠(또는 ⓘ) 아이콘을 눌러 카메라를 '허용'으로 바꿔 주세요.",
      "iPhone Safari는 설정 → Safari → 카메라에서도 바꿀 수 있습니다.",
      "권한을 바꾼 뒤 아래 버튼으로 다시 시도해 주세요.",
    ],
  },
  not_found: {
    title: "쓸 수 있는 카메라를 찾지 못했습니다",
    steps: [
      "전면 카메라가 있는 기기인지 확인해 주세요.",
      "외장 웹캠이라면 연결을 확인하고 다시 시도해 주세요.",
    ],
  },
  in_use: {
    title: "카메라가 다른 곳에서 사용 중입니다",
    steps: [
      "줌·구글 미트·다른 탭처럼 카메라를 쓰는 앱을 모두 종료해 주세요.",
      "그다음 아래 버튼으로 다시 시도해 주세요.",
    ],
  },
  insecure: {
    title: "보안 연결(HTTPS)이 필요합니다",
    steps: [
      "브라우저는 HTTPS에서만 카메라를 허용합니다.",
      "http:// 주소로 접속했다면 https:// 주소로 다시 접속해 주세요.",
    ],
  },
  unsupported: {
    title: "이 브라우저는 카메라를 지원하지 않습니다",
    steps: [
      "사파리·크롬·엣지의 최신 버전에서 열어 주세요.",
      "인앱 브라우저(카카오톡·인스타그램 등)에서는 막히는 경우가 많습니다.",
    ],
  },
  model: {
    title: "얼굴 인식 모델을 불러오지 못했습니다",
    steps: [
      "네트워크 연결을 확인해 주세요. 모델은 처음 한 번 내려받습니다.",
      "잠시 후 다시 시도해 주세요.",
    ],
  },
  unknown: {
    title: "카메라를 시작하지 못했습니다",
    steps: [
      "다른 앱이 카메라를 쓰고 있지 않은지 확인해 주세요.",
      "페이지를 새로 고친 뒤 다시 시도해 주세요.",
    ],
  },
};

export default function BlockedGuide({
  failure,
  duringSession,
  onRetry,
}: BlockedGuideProps) {
  const guide = GUIDE[failure];
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 px-6 py-12">
      <div className="flex flex-col gap-3">
        <span className="text-4xl">📷</span>
        <h1 className="text-2xl font-bold leading-snug">{guide.title}</h1>
        {duringSession && (
          <p className="rounded-xl border border-sky-800 bg-sky-950/60 p-3 text-sm leading-relaxed">
            세션은 일시정지해 두었습니다. 카메라가 돌아오면 이어서 계속할 수 있습니다.
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-surface p-5 text-sm leading-relaxed">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="shrink-0 font-bold text-blue-400">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="rounded-2xl bg-blue-600 py-4 text-lg font-bold transition-colors hover:bg-blue-500"
        >
          다시 시도
        </button>
        <p className="text-center text-sm text-muted">
          {failure === "model"
            ? "모델을 불러오지 못하면 아바타 마스킹과 집중 감지를 할 수 없습니다."
            : "카메라 없이는 집중 감지를 할 수 없습니다. 지금은 여기까지가 한계입니다."}
        </p>
        <Link href="/" className="text-center text-sm text-muted underline">
          첫 화면으로
        </Link>
      </div>
    </div>
  );
}
