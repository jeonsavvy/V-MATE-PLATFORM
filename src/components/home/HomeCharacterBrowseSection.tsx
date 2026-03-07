import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { CHARACTER_UI_META, type CharacterFilter } from "@/lib/character-ui"
import type { Character, CharacterId } from "@/lib/data"

interface HomeCharacterBrowseSectionProps {
  filteredCharacters: Character[]
  characterFilters: CharacterFilter[]
  activeFilter: CharacterFilter
  onFilterChange: (filter: CharacterFilter) => void
  onSelectCharacterDetail: (characterId: CharacterId) => void
}

export function HomeCharacterBrowseSection({
  filteredCharacters,
  characterFilters,
  activeFilter,
  onFilterChange,
  onSelectCharacterDetail,
}: HomeCharacterBrowseSectionProps) {
  return (
    <section className="space-y-5 rounded-[2rem] border border-border/80 bg-card/82 p-6 shadow-paper md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Character index</p>
          <h3 className="font-display text-[clamp(2rem,4vw,3rem)] text-foreground">캐릭터 모아보기</h3>
        </div>
        <p className="text-sm font-medium text-muted-foreground">총 {filteredCharacters.length}명</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="캐릭터 필터">
        {characterFilters.map((filter) => {
          const isActive = activeFilter === filter
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lift"
                  : "rounded-full border border-border/80 bg-background/70 px-4 py-2 text-sm font-semibold text-muted-foreground shadow-inner-line transition hover:border-primary/30 hover:text-foreground"
              }
            >
              {filter}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCharacters.map((character, index) => {
          const meta = CHARACTER_UI_META[character.id]
          return (
            <motion.button
              key={character.id}
              type="button"
              onClick={() => onSelectCharacterDetail(character.id)}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: index * 0.04 }}
              className="group overflow-hidden rounded-[1.8rem] border border-border/80 bg-background/70 text-left shadow-inner-line transition hover:border-primary/25"
            >
              <div className="relative aspect-[4/3.6] overflow-hidden">
                <img
                  src={character.images.normal}
                  alt={character.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,12,10,0)_24%,rgba(17,12,10,0.72)_100%)]" />
                {meta.badge && (
                  <span className="absolute left-4 top-4 rounded-full border border-white/18 bg-black/20 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/84 backdrop-blur-sm">
                    {meta.badge}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h4 className="text-2xl font-semibold leading-tight tracking-[-0.03em]">{character.name}</h4>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <p className="text-sm leading-7 text-muted-foreground">{meta.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {meta.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border/80 bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  상세 보기
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {filteredCharacters.length === 0 && (
        <div className="rounded-[1.8rem] border border-dashed border-border/80 bg-background/60 px-6 py-16 text-center text-sm leading-7 text-muted-foreground">
          검색 결과가 없습니다. 다른 태그나 캐릭터 이름으로 다시 찾아보세요.
        </div>
      )}
    </section>
  )
}
