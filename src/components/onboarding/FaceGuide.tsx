"use client";

/**
 * 얼굴 미검출 재배치 가이드 (UC-1 예외).
 * 온보딩 단계에서만 뜬다 — 세션 중 부재는 감독관 메시지(D-5)가 담당한다.
 */
export default function FaceGuide() {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-3 top-1/2 z-20 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-amber-500/60 bg-amber-950/90 p-5 text-center text-sm leading-relaxed shadow-lg"
    >
      <p className="mb-1.5 text-base font-bold">얼굴이 보이지 않아요</p>
      <p className="text-amber-100/90">
        폰을 얼굴 높이로 세우고, 화면 안에 얼굴이 들어오게 맞춰 주세요. 너무 어두우면
        조명을 켜는 것도 도움이 됩니다.
      </p>
    </div>
  );
}
