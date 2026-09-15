import type { MessageKind } from "./types";

/**
 * 규칙기반 문구 세트 (D-5). 톤: 존댓말, 부드러운 감독관.
 *
 * 경고 종류는 배열 순서가 곧 단계(escalation)다 — 같은 세션에서 n번째 발생이면
 * n번째 문구(마지막 이후는 마지막 반복). 처음은 가볍게, 반복될수록 조금 더 직접적으로.
 * 격려 종류는 순서대로 돌려 쓴다(같은 말 반복 방지).
 */
export const MESSAGE_TEMPLATES: Record<MessageKind, readonly string[]> = {
  session_start: [
    "집중 세션을 시작합니다. 제가 옆에서 지켜볼게요.",
    "준비되셨죠? 오늘도 차분하게 시작해 봅시다.",
  ],
  session_resume: [
    "다시 시작할게요. 남은 시간도 함께 갈게요.",
    "휴식 잘 하셨나요? 이어서 집중해 봅시다.",
  ],
  away: [
    "자리를 비우신 것 같아요. 잠시 후에 다시 봐요.",
    "또 자리를 비우셨네요. 돌아오시면 이어서 시작해요.",
    "자리를 자주 비우고 계세요. 필요하면 휴식 버튼을 눌러 주세요.",
  ],
  away_long: [
    "꽤 오래 자리를 비우셨어요. 휴식으로 전환하거나 세션을 마무리할까요?",
  ],
  welcome_back: [
    "돌아오셨네요. 다시 집중해 봅시다.",
    "다시 시작할 준비 되셨죠? 이어서 가볼게요.",
    "잘 돌아오셨어요. 흐름을 다시 잡아 봐요.",
  ],
  head_down: [
    "고개가 오래 숙여져 있어요. 잠깐 스트레칭 어떠세요?",
    "계속 고개를 숙이고 계시네요. 졸리시면 잠깐 쉬어도 괜찮아요.",
    "자세가 많이 무너졌어요. 짧게라도 휴식을 권해요.",
  ],
  head_up: [
    "좋아요, 자세를 다시 잡으셨네요.",
    "다시 집중 모드로 돌아왔어요.",
  ],
  focus_milestone: [
    "{minutes}분 집중하셨어요. 잘하고 계세요.",
    "{minutes}분째 흐름을 유지하고 있어요. 이 페이스 좋아요.",
    "벌써 {minutes}분 집중이에요. 조용히 응원하고 있어요.",
  ],
  goal_reached: [
    "목표 시간을 달성했어요! 오늘 정말 잘하셨어요.",
  ],
};

/** {minutes} 같은 자리표시자를 채운다 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
