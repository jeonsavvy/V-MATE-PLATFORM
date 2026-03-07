import { CHARACTER_UI_META } from "@/lib/character-ui"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { SidebarCharacterEntry } from "@/lib/chat/sidebarEntries"

interface CharacterSidebarProps {
  entries: SidebarCharacterEntry[]
  activeCharacterId: string
  onCharacterChange: (charId: string) => void
}

export function CharacterSidebar({
  entries,
  activeCharacterId,
  onCharacterChange,
}: CharacterSidebarProps) {
  return (
    <aside className="hidden h-full border-r border-border/70 bg-card/72 p-4 backdrop-blur lg:flex lg:flex-col">
      <div className="flex h-full flex-col gap-4">
        <div className="space-y-2 px-2 pt-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Conversation index</p>
          <h2 className="font-display text-3xl text-foreground">대화 보관함</h2>
          <p className="text-sm leading-6 text-muted-foreground">최근 기록이 있는 캐릭터부터 정리해 보여줍니다.</p>
        </div>

        <div className="space-y-2 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const item = entry.character
            const meta = CHARACTER_UI_META[item.id]
            const isActive = item.id === activeCharacterId

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onCharacterChange(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "w-full rounded-[1.6rem] border p-3 text-left transition",
                  isActive
                    ? "border-primary/30 bg-background shadow-lift"
                    : "border-border/70 bg-background/55 shadow-inner-line hover:border-primary/18 hover:bg-background/72"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={item.images.normal}
                    alt={item.name}
                    fallback={item.name[0]}
                    className="size-12 rounded-[1rem] border border-border/80 object-cover object-top"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {entry.hasHistory ? "recent scene" : "new conversation"}
                        </p>
                      </div>
                      <span className="rounded-full border border-border/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {meta.badge || "curated"}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{entry.previewText}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
