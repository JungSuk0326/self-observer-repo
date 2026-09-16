import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "마스킹 캠스터디 — Focus Guardian",
  description:
    "캐릭터로 얼굴을 가려 노출 부담 없이, 혼자여도 AI 감독관이 지켜보는 온라인 독서실. 설치 없이 브라우저에서 바로 시작합니다.",
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  // 세션 화면이 노치/홈바까지 채우므로 safe-area 인셋이 필요하다
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
