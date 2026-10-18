import { MESSAGE_TEMPLATES } from "./messages";
import type { MessageKind } from "./types";

/**
 * 감독관 페르소나. 같은 규칙 엔진(MessageEngine)에 문구 세트와 음성 톤만 바꿔 끼운다.
 * 문구 규칙은 messages.ts와 같다: 경고는 배열 순서가 단계(점점 직접적으로),
 * 격려는 순서대로 돌려 쓴다. focus_milestone에는 {minutes} 자리표시자가 있어야 한다.
 *
 * 톤 원칙: 엄격해도 모욕하지 않는다. 경고 한 건이 사용자를 떠나게 할 수 있다(원칙 4의 연장).
 * 나중에 WebLLM 대화(P3)를 붙일 때 이 정의가 그대로 페르소나 프롬프트의 바탕이 된다.
 */
export interface Persona {
  id: string;
  name: string;
  emoji: string;
  /** 선택 화면 한 줄 소개 */
  tagline: string;
  /** Web Speech 음성 톤 */
  voice: { rate: number; pitch: number };
  templates: Record<MessageKind, readonly string[]>;
}

const DRILL: Record<MessageKind, readonly string[]> = {
  session_start: ["집중 세션 시작한다. 지금부터 딴짓은 없다.", "자리 확인 완료. 시작한다."],
  session_resume: ["휴식 끝. 다시 집중한다.", "복귀 확인. 이어서 간다."],
  away: [
    "자리 이탈 확인. 빨리 복귀한다.",
    "또 자리 이탈이다. 돌아오면 바로 이어간다.",
    "이탈이 잦다. 쉴 거면 휴식 버튼을 누른다.",
  ],
  away_long: ["장시간 이탈이다. 휴식으로 바꾸든지, 오늘은 여기서 끝내든지 정한다."],
  welcome_back: ["복귀 확인. 바로 이어간다.", "돌아왔군. 좋다, 다시 시작한다."],
  head_down: [
    "고개가 떨어졌다. 자세 바로.",
    "또 고개가 숙여졌다. 졸리면 일어나서 스트레칭한다.",
    "자세가 계속 무너진다. 2분 쉬고 다시 한다.",
  ],
  head_up: ["자세 좋다. 유지한다.", "그렇지. 그 자세다."],
  look_away: [
    "시선 이탈. 화면으로 돌아온다.",
    "또 딴 데 본다. 책으로 복귀.",
    "시선이 계속 샌다. 휴대폰이라면 멀리 둔다.",
  ],
  look_back: ["시선 복귀 확인.", "좋다. 계속 간다."],
  focus_milestone: [
    "{minutes}분 집중 달성. 잘하고 있다.",
    "{minutes}분째 버티고 있다. 이 페이스 유지.",
    "{minutes}분. 흔들림 없다. 훌륭하다.",
  ],
  goal_reached: ["목표 달성. 오늘 임무 완수다. 수고했다."],
};

const CAT: Record<MessageKind, readonly string[]> = {
  session_start: [
    "흥, 공부한다고? 내가 지켜봐 줄 테니 딴짓하지 마라냥.",
    "또 왔냐냥. ...딱히 기다린 건 아니다냥.",
  ],
  session_resume: ["쉬는 거 끝났냥? 이제 다시 해라냥.", "돌아왔냥. 이어서 하자냥."],
  away: [
    "어디 갔냥...? 빨리 와라냥.",
    "또 사라졌냥! 나 혼자 두지 마라냥.",
    "자꾸 없어지면 삐질 거다냥. 쉴 거면 휴식 버튼 눌러라냥.",
  ],
  away_long: ["너무 오래 없잖냥... 오늘은 그만할 거냥? 휴식이든 종료든 골라라냥."],
  welcome_back: [
    "흥, 늦었다냥. ...그래도 왔으니 됐다냥.",
    "돌아왔냥! 아, 아니 반가운 건 아니다냥.",
  ],
  head_down: [
    "고개 숙이고 자는 거 아니냥? 다 보인다냥.",
    "또 졸지? 기지개 좀 켜라냥.",
    "꾸벅꾸벅... 잠깐 쉬었다 하라냥. 걱정돼서 그런 거 아니다냥.",
  ],
  head_up: ["오, 정신 차렸냥.", "그래, 그렇게 앉아라냥."],
  look_away: [
    "어디 보냥? 여기 봐라냥.",
    "또 딴 데 본다냥! 책은 여기 있다냥.",
    "자꾸 한눈팔면 책 위에 드러누울 거다냥.",
  ],
  look_back: ["흥, 돌아왔냥.", "그래, 거기 집중해라냥."],
  focus_milestone: [
    "{minutes}분 했냥? ...제법이다냥.",
    "{minutes}분째다냥. 칭찬은 아니고 그냥 사실이다냥.",
    "벌써 {minutes}분이냥! 조, 조금 대단하다냥.",
  ],
  goal_reached: ["목표 달성이냥! ...잘했다냥. 이번만 인정해 준다냥."],
};

export const PERSONAS: Persona[] = [
  {
    id: "mentor",
    name: "다정한 선배",
    emoji: "🧑‍🏫",
    tagline: "부드럽게 다독여 줘요",
    voice: { rate: 1.0, pitch: 1.0 },
    templates: MESSAGE_TEMPLATES,
  },
  {
    id: "drill",
    name: "엄격한 조교",
    emoji: "🪖",
    tagline: "짧고 단호하게 잡아 줘요",
    voice: { rate: 1.1, pitch: 0.8 },
    templates: DRILL,
  },
  {
    id: "cat",
    name: "츤데레 고양이",
    emoji: "🐈",
    tagline: "관심 없는 척 다 지켜봐요",
    voice: { rate: 1.05, pitch: 1.5 },
    templates: CAT,
  },
];

export const DEFAULT_PERSONA = PERSONAS[0];

export function getPersonaById(id: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? DEFAULT_PERSONA;
}
