import Link from "next/link";

const VALUE_POINTS = [
  {
    emoji: "🐻",
    title: "얼굴 대신 캐릭터",
    body: "카메라는 켜지만 화면에 나가는 건 내 얼굴이 아니라 아바타입니다. 방도, 화장 안 한 얼굴도 보여줄 필요가 없습니다.",
  },
  {
    emoji: "👀",
    title: "혼자여도 지켜보는 감독관",
    body: "자리를 비우거나 고개가 오래 숙여지면 감독관이 말을 겁니다. 거치한 폰 하나가 독서실 총무 역할을 합니다.",
  },
  {
    emoji: "🔒",
    title: "영상은 기기를 떠나지 않음",
    body: "얼굴 인식과 판단은 전부 이 브라우저 안에서 일어납니다. 혼자 모드에서는 카메라 영상이 서버로 전송되지 않습니다.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-semibold tracking-wide text-blue-400">
          마스킹 캠스터디
        </p>
        <h1 className="text-3xl font-bold leading-snug">
          얼굴은 가리고,
          <br />
          집중은 감시받기
        </h1>
        <p className="leading-relaxed text-muted">
          캐릭터로 얼굴을 가린 채 카메라를 켜고 공부합니다. 자리를 비우면 AI 감독관이
          알아채고, 끝나면 집중한 시간이 남습니다.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href="/session"
          className="rounded-2xl bg-blue-600 py-4 text-center text-lg font-bold transition-colors hover:bg-blue-500"
        >
          바로 체험하기
        </Link>
        <p className="text-center text-sm text-muted">
          가입 없이 바로 시작합니다. 카메라 권한만 필요합니다.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {VALUE_POINTS.map((p) => (
          <li
            key={p.title}
            className="rounded-2xl border border-gray-800 bg-surface p-5"
          >
            <p className="mb-1.5 text-base font-bold">
              <span className="mr-2">{p.emoji}</span>
              {p.title}
            </p>
            <p className="text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2 rounded-2xl border border-gray-800 p-5 text-sm text-muted">
        <p className="font-semibold text-foreground">시작하기 전에</p>
        <p>· 카메라가 있는 기기와 HTTPS 접속이 필요합니다.</p>
        <p>· 폰을 거치해서 쓰는 걸 권합니다. 화면은 세션 중 꺼지지 않습니다.</p>
        <p>· 동료와 함께하는 &lsquo;함께 모드&rsquo;는 준비 중입니다. 지금은 혼자 모드만 제공합니다.</p>
      </section>
    </main>
  );
}
