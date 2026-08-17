# Focus Guardian (가칭) — 마스킹 캠스터디

"AI 감독관이 상주하는 마스킹 캠스터디". 캐릭터로 얼굴을 가려 노출 부담 없이, 혼자여도 AI가 지켜봐 집중이 되는 온라인 독서실 웹앱.

## 문서

- [기획서.md](기획서.md) — 왜 만드는가 (포지셔닝·정책·BM·로드맵)
- [기능명세-유즈케이스.md](기능명세-유즈케이스.md) — 무엇을 어떤 순서로 (기능·유즈케이스·MVP 개발 순서)
- [CLAUDE.md](CLAUDE.md) — 개발 가이드 (아키텍처 원칙)
- [spike/index.html](spike/index.html) — 선검증 스파이크 (모바일 MediaPipe 성능 테스트, 통과)

## 개발

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # 린트
```

폰에서 테스트(카메라는 HTTPS 필수):

```bash
cloudflared tunnel --url http://localhost:3000
```

## 스택

Next.js (App Router) · TypeScript · Tailwind CSS · MediaPipe Face Landmarker · IndexedDB
