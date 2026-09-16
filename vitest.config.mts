import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 순수 로직 단위 테스트용 설정.
 * tsconfig의 `@/*` 경로 별칭을 vitest에도 알려준다 — 없으면 값(타입 아님)을
 * `@/`로 가져오는 모듈이 테스트에서만 해석 실패한다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
