import { ArrowLeft, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CHARACTERS, type Character } from "@/lib/data"

interface ChatTopBarProps {
  character: Character
  characterTags: string[]
  isInfoPanelOpen: boolean
  onBack: () => void
  onToggleInfoPanel: () => void
  onClearChat: () => void
  onCharacterChange: (charId: string) => void
}

export function ChatTopBar({
  character,
  characterTags,
  isInfoPanelOpen,
  onBack,
  onToggleInfoPanel,
  onClearChat,
  onCharacterChange,
}: ChatTopBarProps) {
  return (
    <header className="border-b border-border/70 bg-card/76 px-3 py-4 backdrop-blur md:px-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="px-3 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">홈으로</span>
          </Button>

          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Private session</p>
            <p className="truncate text-xl font-semibold tracking-[-0.03em] text-foreground">{character.name}</p>
            <p className="truncate text-sm text-muted-foreground">{characterTags.join(" · ")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant={isInfoPanelOpen ? "secondary" : "ghost"}
            onClick={onToggleInfoPanel}
            className="px-3 text-xs sm:text-sm"
            aria-expanded={isInfoPanelOpen}
            aria-label={isInfoPanelOpen ? "캐릭터 정보 패널 닫기" : "캐릭터 정보 패널 열기"}
          >
            {isInfoPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            정보
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClearChat}
            className="px-3 text-muted-foreground hover:text-destructive"
            title="대화 초기화"
            aria-label="대화 초기화"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <select
            value={character.id}
            onChange={(e) => onCharacterChange(e.target.value)}
            aria-label="캐릭터 선택"
            className="h-10 rounded-full border border-border/80 bg-background/80 px-3 text-xs font-medium text-foreground shadow-inner-line outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 xl:hidden"
          >
            {Object.values(CHARACTERS).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
