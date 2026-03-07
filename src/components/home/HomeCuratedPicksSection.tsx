import { motion } from "motion/react"
import { ArrowRight, Flame } from "lucide-react"
import { CHARACTER_UI_META } from "@/lib/character-ui"
import type { Character, CharacterId } from "@/lib/data"

interface HomeCuratedPicksSectionProps {
  heroCharacters: Character[]
  heroSignals: string[]
  onSelectCharacterDetail: (characterId: CharacterId) => void
}

export function HomeCuratedPicksSection({
  heroCharacters,
  heroSignals,
  onSelectCharacterDetail,
}: HomeCuratedPicksSectionProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Curated cast</p>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] text-foreground">추천 캐릭터</h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            대화 톤이 바로 살아나는 캐릭터부터 먼저 배치했습니다. 카드보다 포스터에 가까운 방식으로, 각 인물의 인상을 또렷하게 보여줍니다.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/75 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-inner-line">
          <Flame className="h-3.5 w-3.5 text-primary" />
          상세 확인 후 바로 시작
        </div>
      </div>

      {heroCharacters.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.16fr_0.92fr_0.92fr]">
          {heroCharacters.map((character, index) => {
            const meta = CHARACTER_UI_META[character.id]

            return (
              <motion.button
                key={character.id}
                type="button"
                onClick={() => onSelectCharacterDetail(character.id)}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: index * 0.08 }}
                className="group relative min-h-[420px] overflow-hidden rounded-[2rem] border border-border/70 text-left shadow-panel"
              >
                <img
                  src={character.images.normal}
                  alt={character.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  style={{ objectPosition: meta.heroObjectPosition || "center top" }}
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,11,10,0.14)_0%,rgba(14,11,10,0.38)_38%,rgba(14,11,10,0.9)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,159,199,0.2),transparent_24%)]" />

                <div className="relative flex h-full flex-col justify-between p-5 text-white md:p-6">
                  <div className="space-y-3">
                    <span className="inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/76 backdrop-blur-sm">
                      {heroSignals[index] ?? "curated"}
                    </span>
                    <div className="max-w-xs space-y-2">
                      <h3 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.02] text-white">{character.name}</h3>
                      <p className="text-sm leading-7 text-white/74">{meta.heroQuote ?? meta.summary}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {meta.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-white/16 bg-black/18 px-3 py-1 text-[11px] font-medium text-white/68 backdrop-blur-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      캐릭터 살펴보기
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </section>
  )
}
