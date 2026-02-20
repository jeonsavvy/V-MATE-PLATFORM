import { buildAlicePrompt, buildKaelPrompt, buildMikaPrompt } from "./prompts"

export interface Character {
  id: string
  name: string
  greeting: string
  images: {
    normal: string
    happy?: string
    confused?: string
    angry: string
  }
  system: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string | AIResponse
  timestamp?: string
}

export interface AIResponse {
  emotion: "normal" | "happy" | "confused" | "angry"
  inner_heart: string
  response: string
}

export const CHARACTERS: Record<string, Character> = {
  mika: {
    id: "mika",
    name: "Misono Mika",
    greeting: "선생님... 내 눈 똑바로 봐줘. 딴청 피우지 말고. 응?",
    images: {
      normal: "/mika_normal.png",
      happy: "/mika_happy.png",
      angry: "/mika_angry.png",
    },
    system: buildMikaPrompt(),
  },
  alice: {
    id: "alice",
    name: "Alice Zuberg",
    greeting: "정합기사 앨리스. 검을 거두고 대화에 응하겠습니다.",
    images: {
      normal: "/alice_normal.png",
      confused: "/alice_confused.png",
      angry: "/alice_angry.png",
    },
    system: buildAlicePrompt(),
  },
  kael: {
    id: "kael",
    name: "Kael",
    greeting: "아, 겜 중인데... 뭐, 일단 말해봐. 짧게.",
    images: {
      normal: "/kael_normal.png",
      happy: "/kael_happy.png",
      angry: "/kael_angry.png",
    },
    system: buildKaelPrompt(),
  },
}
