"use client";

import Link from "next/link";

interface WelcomeGuideProps {
  /** 카메라 권한 요청 + 모델 로딩 중 */
  loading: boolean;
  onStart: () => void;
}

/**
 * 권한 요청 직전 안내 (A-3, UC-1 #2).
 *
 * 브라우저 권한 프롬프트를 바로 띄우지 않고 이유를 먼저 설명한다. 맥락 없이 뜬
 * 프롬프트는 거부율이 높고, 한번 거부되면 되돌리기가 번거롭다.
 * 시작 버튼은 반드시 사용자 제스처여야 한다 — iOS는 제스처 밖 카메라를 막는다.
 */
export default function WelcomeGuide({ loading, onStart }: WelcomeGuideProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <span className="text-4xl">🐻</span>
        <h1 className="text-2xl font-bold leading-snug">
          카메라를 켜면
          <br />
          아바타가 대신 나옵니다
        </h1>
        <p className="leading-relaxed text-muted">
          얼굴을 읽어 아바타를 움직이고, 자리를 비웠는지·고개가 숙여졌는지만
          판단합니다. 화면에 보이는 건 아바타뿐입니다.
        </p>
      </div>

      <ul className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-surface p-5 text-sm leading-relaxed">
        <li>
          <span className="mr-2">🔒</span>
          영상과 얼굴 데이터는 이 브라우저 안에서만 처리되고 서버로 전송되지 않습니다.
        </li>
        <li>
          <span className="mr-2">🗂️</span>
          아바타 선택·기준 자세·세션 기록은 이 기기에만 저장됩니다.
        </li>
        <li>
          <span className="mr-2">⏹️</span>
          언제든 나갈 수 있고, 나가면 카메라 접근이 끝납니다.
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        <button
          onClick={onStart}
          disabled={loading}
          className="rounded-2xl bg-blue-600 py-4 text-lg font-bold transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "카메라·모델 준비 중…" : "카메라 켜고 시작"}
        </button>
        {loading ? (
          <p className="text-center text-sm text-muted">
            처음 한 번은 얼굴 인식 모델을 내려받습니다. 몇 초 걸릴 수 있습니다.
          </p>
        ) : (
          <Link href="/" className="text-center text-sm text-muted underline">
            돌아가기
          </Link>
        )}
      </div>
    </div>
  );
}
