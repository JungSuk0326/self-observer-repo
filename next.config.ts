import type { NextConfig } from "next";

/**
 * GitHub Pages 배포용 설정.
 *
 * 이 앱은 서버 로직이 없다(비전·판정·저장 전부 브라우저 안 — 아키텍처 원칙 1).
 * 그래서 정적 파일로 통째로 내보낼 수 있고, 정적 호스팅이면 어디든 올라간다.
 *
 * export/basePath는 CI에서 PAGES_BASE_PATH가 있을 때만 켠다. 로컬 `npm run dev`는
 * 지금까지와 똑같이 http://localhost:3000/ 루트에서 뜬다 (폰 터널 테스트 유지).
 */
const rawBasePath = process.env.PAGES_BASE_PATH ?? "";
// Pages 프로젝트 사이트는 "/self-observer-repo", 사용자 사이트는 "/" 또는 빈 값으로 온다.
// Next는 빈 문자열이거나 슬래시로 끝나지 않는 경로만 받는다.
const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/, "");
const isPagesBuild = process.env.PAGES_BASE_PATH !== undefined;

const nextConfig: NextConfig = {
  // cloudflared 터널로 폰 테스트 시 dev 리소스 cross-origin 차단 해제
  allowedDevOrigins: ["*.trycloudflare.com"],
  ...(isPagesBuild
    ? {
        output: "export" as const,
        // 정적 호스팅에서 확장자 없는 경로를 확실히 찾게 한다 (/session/index.html)
        trailingSlash: true,
        basePath,
      }
    : {}),
};

export default nextConfig;
