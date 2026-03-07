import { motion } from "motion/react"
import { ArrowRight, Clock3, Heart, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CHARACTERS, type Character, type CharacterId } from "@/lib/data"
import { CHARACTER_UI_META } from "@/lib/character-ui"
import type { RecentChatItem } from "@/lib/chat/historyRepository"

interface HomeHeroSectionProps {
  primaryCharacter: Character
  primaryHeroQuote: string
  primaryObjectPosition?: string
  recentChatsCount: number
  recentContinuation: RecentChatItem[]
  onCharacterSelect: (character: Character) => void
  onSelectCharacterDetail: (characterId: CharacterId) => void
  formatRelativeTime: (updatedAt: string | null) => string
}

export function HomeHeroSection({
  primaryCharacter,
  primaryHeroQuote,
  primaryObjectPosition,
  recentChatsCount,
  recentContinuation,
  onCharacterSelect,
  onSelectCharacterDetail,
  formatRelativeTime,
}: HomeHeroSectionProps) {
  const primaryMeta = CHARACTER_UI_META[primaryCharacter.id]

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2.2rem] border border-border/80 bg-card/90 p-6 shadow-panel backdrop-blur md:p-8"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Private atelier
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-[clamp(2.8rem,6vw,5.2rem)] text-balance text-foreground">
                겉말은 정교하게,
                <br />
                속마음은 더 솔직하게.
              </h1>
              <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
                V-MATE는 캐릭터의 표정 변화, 겉으로 건네는 말, 그리고 숨겨진 속마음까지 한 장면처럼 이어서 보여주는
                대화실입니다.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.6rem] border border-border/80 bg-background/78 p-4 shadow-inner-line">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Featured</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{primaryCharacter.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">오늘 가장 먼저 열어보기 좋은 캐릭터</p>
            </div>
            <div className="rounded-[1.6rem] border border-border/80 bg-background/78 p-4 shadow-inner-line">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Library</p>
              <p className="mt-2 text-lg font-semibold text-foreground">3 Curated personas</p>
              <p className="mt-1 text-sm text-muted-foreground">성향이 다른 세 명의 캐릭터를 골라 시작</p>
            </div>
            <div className="rounded-[1.6rem] border border-border/80 bg-background/78 p-4 shadow-inner-line">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Continuity</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{recentChatsCount}개의 최근 기록</p>
              <p className="mt-1 text-sm text-muted-foreground">로그인 후 이어보기와 동기화를 지원</p>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-border/80 bg-secondary/45 p-5 shadow-inner-line">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Signature line</p>
            <p className="mt-3 font-display text-2xl leading-[1.45] text-foreground sm:text-[2rem]">“{primaryHeroQuote}”</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => onCharacterSelect(primaryCharacter)} className="px-6">
              {primaryCharacter.name}와 대화 시작
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => onSelectCharacterDetail(primaryCharacter.id)} className="px-5">
              캐릭터 상세 보기
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
          <div className="rounded-[1.9rem] border border-border/80 bg-background/80 p-5 shadow-inner-line">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">지금 이어서 대화하기</p>
              </div>
              <p className="text-xs font-medium text-muted-foreground">최근 {recentChatsCount}개</p>
            </div>

            {recentContinuation.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentContinuation.map((item, index) => {
                  const character = CHARACTERS[item.characterId]
                  if (!character) {
                    return null
                  }

                  return (
                    <motion.button
                      key={item.characterId}
                      type="button"
                      onClick={() => onCharacterSelect(character)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * index }}
                      className="group flex w-full items-center gap-3 rounded-[1.45rem] border border-border/70 bg-card/86 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card"
                    >
                      <img
                        src={character.images.normal}
                        alt={character.name}
                        className="h-14 w-14 rounded-[1rem] object-cover object-top"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{character.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{item.preview}</p>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {formatRelativeTime(item.updatedAt)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                    </motion.button>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.45rem] border border-dashed border-border/80 bg-card/70 px-4 py-5 text-sm leading-6 text-muted-foreground">
                아직 저장된 대화가 없습니다. 첫 메시지를 남기면 이곳에서 가장 최근 장면부터 다시 이어갈 수 있어요.
              </div>
            )}
          </div>

          <div className="rounded-[1.9rem] border border-border/80 bg-[#201917] p-5 text-white shadow-panel">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/58">Dual psychology</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.35rem] border border-white/12 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Heart className="h-4 w-4 text-[#f1a4ba]" />
                  inner heart
                </div>
                <p className="mt-2 text-sm leading-6 text-white/70">겉으로 말하지 않는 감정을 따로 읽어낼 수 있어, 장면의 밀도가 한 단계 더 올라갑니다.</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/12 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">{primaryMeta.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {primaryMeta.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/14 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/64">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.aside
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative min-h-[680px] overflow-hidden rounded-[2.2rem] border border-border/70 bg-[#1a1413] text-white shadow-panel"
      >
        <img
          src={primaryCharacter.images.normal}
          alt={`${primaryCharacter.name} 대표 이미지`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: primaryObjectPosition || "center top" }}
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,11,0.18)_0%,rgba(16,12,11,0.3)_32%,rgba(16,12,11,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,155,187,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(123,92,184,0.18),transparent_28%)]" />

        <div className="relative flex h-full flex-col justify-between p-6 md:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/65">
              <span>Featured character</span>
              <span>{primaryMeta.badge || "curated"}</span>
            </div>
            <div className="max-w-[22rem] space-y-4">
              <h2 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-[1.05] text-white">{primaryCharacter.name}</h2>
              <p className="text-sm leading-7 text-white/78 md:text-base">{primaryMeta.summary}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/58">Scene note</p>
              <p className="mt-3 font-display text-[1.8rem] leading-[1.5] text-white">“{primaryHeroQuote}”</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {primaryMeta.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/78 backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => onCharacterSelect(primaryCharacter)} className="bg-white text-[#1a1413] hover:bg-white/92">
                대화 시작
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => onSelectCharacterDetail(primaryCharacter.id)}
                className="border border-white/18 bg-white/10 px-5 text-white hover:bg-white/16 hover:text-white"
              >
                캐릭터 프로필
              </Button>
            </div>
          </div>
        </div>
      </motion.aside>
    </section>
  )
}
