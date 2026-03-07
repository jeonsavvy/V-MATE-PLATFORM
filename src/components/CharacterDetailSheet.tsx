import { MessageCircle } from "lucide-react"
import { Character } from "@/lib/data"
import { CharacterUiMeta } from "@/lib/character-ui"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog"

interface CharacterDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  character: Character
  meta: CharacterUiMeta
  onStartChat: () => void
}

export function CharacterDetailSheet({
  open,
  onOpenChange,
  character,
  meta,
  onStartChat,
}: CharacterDetailSheetProps) {
  const handleStartChat = () => {
    onOpenChange(false)
    onStartChat()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <DialogTitle className="sr-only">{character.name} 상세 정보</DialogTitle>
        <DialogDescription className="sr-only">{meta.summary}</DialogDescription>

        <div className="grid gap-0 md:grid-cols-[1.02fr_0.98fr]">
          <div className="relative min-h-[340px] overflow-hidden border-b border-border/70 md:border-b-0 md:border-r">
            <img
              src={character.images.normal}
              alt={character.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,13,11,0.08)_0%,rgba(18,13,11,0.74)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,161,180,0.22),transparent_26%)]" />
            <div className="relative flex h-full flex-col justify-between p-6 text-white md:p-8">
              <div className="space-y-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/65">Character dossier</p>
                {meta.badge && (
                  <span className="inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/86 backdrop-blur-sm">
                    {meta.badge}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-[clamp(2.4rem,4vw,3.8rem)] leading-[1.04]">{character.name}</h2>
                {meta.heroQuote && <p className="max-w-md text-base leading-7 text-white/78">“{meta.heroQuote}”</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-card/96 p-6 md:p-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Overview</p>
                <p className="text-sm leading-7 text-muted-foreground">{meta.summary}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">키워드</p>
                <div className="flex flex-wrap gap-2">
                  {meta.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-primary/18 bg-primary/[0.05] px-4 py-4 shadow-inner-line">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/75">Tone</p>
                <p className="mt-2 text-sm leading-7 text-foreground/82">
                  감정이 바뀌는 순간의 표정 카드와 속마음을 함께 보여줘, 캐릭터의 결이 더 입체적으로 보이도록 설계된 타입입니다.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={handleStartChat} className="flex-1 min-w-[12rem]">
                <MessageCircle className="h-4 w-4" />
                대화 시작하기
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-[9rem]">
                닫기
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
