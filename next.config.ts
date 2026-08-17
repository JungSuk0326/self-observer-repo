import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cloudflared 터널로 폰 테스트 시 dev 리소스 cross-origin 차단 해제
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
