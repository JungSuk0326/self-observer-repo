import { describe, expect, it } from "vitest";
import { MESSAGE_TEMPLATES } from "./messages";
import { PERSONAS, getPersonaById } from "./personas";
import type { MessageKind } from "./types";

const KINDS = Object.keys(MESSAGE_TEMPLATES) as MessageKind[];

describe("페르소나 문구 세트", () => {
  for (const p of PERSONAS) {
    it(`${p.name}: 모든 메시지 종류에 문구가 있다`, () => {
      for (const k of KINDS) expect(p.templates[k]?.length ?? 0).toBeGreaterThan(0);
    });

    it(`${p.name}: 경고는 3단계, 이정표에는 {minutes}가 있다`, () => {
      for (const k of ["away", "head_down", "look_away"] as const) {
        expect(p.templates[k].length).toBe(3);
      }
      for (const t of p.templates.focus_milestone) expect(t).toContain("{minutes}");
    });
  }

  it("모르는 id는 기본 페르소나", () => {
    expect(getPersonaById("nope").id).toBe("mentor");
    expect(getPersonaById(null).id).toBe("mentor");
  });
});

describe("페르소나 인사", () => {
  const KINDS = ["first", "again_today", "streak", "yesterday", "long_gap"] as const;
  for (const p of PERSONAS) {
    it(`${p.name}: 인사 5종과 자리표시자`, () => {
      for (const k of KINDS) expect(p.greetings[k].length).toBeGreaterThan(0);
      expect(p.greetings.again_today).toContain("{minutes}");
      expect(p.greetings.yesterday).toContain("{minutes}");
      expect(p.greetings.streak).toContain("{days}");
      expect(p.greetings.long_gap).toContain("{days}");
    });
  }
});

describe("손 딴짓 문구", () => {
  for (const p of PERSONAS) {
    it(`${p.name}: phone 3단계, phone_down·nose_pick 존재`, () => {
      expect(p.templates.phone.length).toBe(3);
      expect(p.templates.phone_down.length).toBeGreaterThan(0);
      expect(p.templates.nose_pick.length).toBeGreaterThan(0);
    });
  }
});
