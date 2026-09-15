/**
 * Web Speech API 얇은 어댑터 (D-5 음성, 선택 기능).
 *
 * - 브라우저 로컬 합성만 사용 (로컬 우선 원칙). 서버 TTS 없음.
 * - iOS Safari는 사용자 제스처 없이 speak()를 막는다. 음성을 켜는 버튼
 *   클릭 안에서 unlock()을 호출해 첫 발화를 제스처에 묶어 둔다.
 * - 새 메시지가 오면 이전 발화를 끊는다. 경고가 밀려 쌓이면 잔소리가 된다.
 */
export interface Speaker {
  readonly supported: boolean;
  /** 사용자 제스처 핸들러 안에서 호출 — 이후 speak()가 자동재생 정책에 걸리지 않음 */
  unlock(): void;
  speak(text: string): void;
  cancel(): void;
}

export function createSpeaker(lang = "ko-KR"): Speaker {
  const synth =
    typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : null;

  const utter = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.0;
    u.pitch = 1.0;
    const voice = synth?.getVoices().find((v) => v.lang.replace("_", "-") === lang);
    if (voice) u.voice = voice;
    return u;
  };

  return {
    supported: synth !== null,
    unlock() {
      if (!synth) return;
      // 빈 문장을 한 번 말해 제스처에 묶는다 (iOS)
      synth.cancel();
      synth.speak(utter(" "));
    },
    speak(text) {
      if (!synth) return;
      synth.cancel();
      synth.speak(utter(text));
    },
    cancel() {
      synth?.cancel();
    },
  };
}
