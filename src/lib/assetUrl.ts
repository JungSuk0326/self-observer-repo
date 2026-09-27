/**
 * public/ 자산의 실제 URL.
 * GitHub Pages는 하위 경로(/self-observer-repo)에 올라가는데, next/link와 달리
 * 코드에서 직접 fetch/로드하는 자산에는 basePath가 자동으로 붙지 않는다.
 * 로컬 dev에서는 빈 문자열이라 그대로 루트 경로다.
 */
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
