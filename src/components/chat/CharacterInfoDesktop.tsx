import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import type { Character } from "@/lib/data"

interface CharacterInfoDesktopProps {
  isOpen: boolean
  character: Character
  tags: string[]
  summary: string
  heroQuote?: string
  activeEmotionLabel: string
  showEmotionIllustrations: boolean
  onToggleIllustrations: () => void
}

export function CharacterInfoDesktop({
  isOpen,
  character,
  tags,
  summary,
  heroQuote,
  activeEmotionLabel,
  showEmotionIllustrations,
  onToggleIllustrations,
}: CharacterInfoDesktopProps) {
  if (!isOpen) {
    return null
  }

  return (
    <aside className="hidden h-full border-l border-border/70 bg-card/72 p-4 backdrop-blur xl:block">
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex h-full flex-col gap-4"
      >
        <div className="overflow-hidden rounded-[2rem] border border-border/80 bg-background/82 shadow-paper">
          <img
            src={character.images.normal}
            alt={character.name}
            className="h-64 w-full object-cover object-top"
            loading="lazy"
            decoding="async"
          />
          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Character note</p>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{character.name}</p>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            {heroQuote && (
              <div className="rounded-[1.6rem] border border-primary/16 bg-primary/[0.06] px-4 py-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Signature line</p>
                <p className="mt-2 font-display text-xl leading-[1.6] text-foreground">“{heroQuote}”</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/80 bg-background/82 p-5 shadow-paper">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Conversation status</p>
          <div className="mt-4 rounded-[1.5rem] border border-border/80 bg-card px-4 py-4 shadow-inner-line">
            <p className="text-sm font-semibold text-foreground">현재 감정 흐름</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{activeEmotionLabel}</p>
          </div>
          <Button
            type="button"
            variant={showEmotionIllustrations ? "secondary" : "outline"}
            onClick={onToggleIllustrations}
            aria-pressed={showEmotionIllustrations}
            className="mt-4 w-full"
            title={showEmotionIllustrations ? "감정 일러스트 숨기기" : "감정 일러스트 보기"}
          >
            {showEmotionIllustrations ? "감정 카드 표시 중" : "감정 카드 숨김"}
          </Button>
        </div>
      </motion.div>
    </aside>
  )
}
