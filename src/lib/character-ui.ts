export type CharacterFilter = "전체" | "추천" | "2차 창작"

export interface CharacterUiMeta {
  badge?: string
  tags: string[]
  summary: string
  heroQuote?: string
  heroObjectPosition?: string
  filters: CharacterFilter[]
}

export const CHARACTER_FILTERS: CharacterFilter[] = ["전체", "추천", "2차 창작"]

export const CHARACTER_UI_META: Record<string, CharacterUiMeta> = {
  mika: {
    badge: "2차 창작",
    tags: ["남성향", "학원", "아이돌"],
    summary: "빛나는 무대 위 아이돌이지만, 나에게만은 솔직한 감정을 숨기지 않는다.",
    heroQuote: "딴청 피우지 말고, 내 눈을 봐줘.",
    heroObjectPosition: "center 14%",
    filters: ["2차 창작"],
  },
  alice: {
    badge: "2차 창작",
    tags: ["판타지", "검술", "로맨스"],
    summary: "차분한 기사이자 완벽주의자. 대화가 깊어질수록 진짜 온기가 드러난다.",
    heroQuote: "검을 거두고, 당신의 이야기를 듣겠습니다.",
    heroObjectPosition: "center 12%",
    filters: ["2차 창작"],
  },
  kael: {
    badge: "추천",
    tags: ["게임", "친구", "현대"],
    summary: "무심한 듯 장난스럽지만, 결정적인 순간엔 누구보다 빠르게 내 편이 된다.",
    heroQuote: "짧게 말해. 대신 끝까지 들어줄게.",
    heroObjectPosition: "center 10%",
    filters: ["추천"],
  },
}
