import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Character } from "@/lib/data"

interface CharacterInfoMobileProps {
  isOpen: boolean
  character: Character
  tags: string[]
  summary: string
  activeEmotionLabel: string
  showEmotionIllustrations: boolean
  onToggleIllustrations: () => void
}

export function CharacterInfoMobile({
  isOpen,
  character,
  tags,
  summary,
  activeEmotionLabel,
  showEmotionIllustrations,
  onToggleIllustrations,
}: CharacterInfoMobileProps) {
  if (!isOpen) {
    return null
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border/70 bg-card/72 px-3 py-3 xl:hidden"
    >
      <div className="mx-auto w-full max-w-[900px] space-y-4 rounded-[1.8rem] border border-border/80 bg-background/78 p-4 shadow-inner-line">
        <div className="flex items-start gap-4">
          <img
            src={character.images.normal}
            alt={character.name}
            className="h-20 w-20 rounded-[1.35rem] object-cover object-top"
            loading="lazy"
            decoding="async"
          />
          <div className="min-w-0 space-y-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Character note</p>
            <p className="text-xl font-semibold tracking-[-0.03em] text-foreground">{character.name}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-border/80 bg-card px-4 py-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Emotion state</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{activeEmotionLabel}</p>
          </div>
          <Button
            type="button"
            variant={showEmotionIllustrations ? "secondary" : "outline"}
            onClick={onToggleIllustrations}
            aria-pressed={showEmotionIllustrations}
            className={cn("px-4 text-xs", showEmotionIllustrations && "text-foreground")}
          >
            {showEmotionIllustrations ? "감정 카드 ON" : "감정 카드 OFF"}
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
