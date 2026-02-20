import { useMemo, useState } from "react"
import { Character, CHARACTERS } from "@/lib/data"
import { CHARACTER_FILTERS, CHARACTER_UI_META, CharacterFilter } from "@/lib/character-ui"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Search, LogOut, Bell, Sparkles, Heart } from "lucide-react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { CharacterDetailSheet } from "./CharacterDetailSheet"

interface HomeProps {
  onCharacterSelect: (character: Character) => void
  user: SupabaseUser | null
  onAuthRequest: () => void
}

export function Home({ onCharacterSelect, user, onAuthRequest }: HomeProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<CharacterFilter>("추천")
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const characters = useMemo(() => Object.values(CHARACTERS), [])

  const filteredCharacters = characters.filter((char) => {
    const meta = CHARACTER_UI_META[char.id]
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch =
      query.length === 0 ||
      char.name.toLowerCase().includes(query) ||
      meta.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      meta.summary.toLowerCase().includes(query)
    const matchesFilter = meta.filters.includes(activeFilter)
    return matchesSearch && matchesFilter
  })

  const heroCharacters = filteredCharacters.slice(0, 3)
  const selectedCharacter = selectedCharacterId ? CHARACTERS[selectedCharacterId] : null
  const selectedCharacterMeta = selectedCharacter ? CHARACTER_UI_META[selectedCharacter.id] : null

  const handleSignOut = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase가 설정되지 않았습니다")
      return
    }
    try {
      await supabase.auth.signOut()
      toast.success("로그아웃되었습니다")
    } catch (error) {
      console.error("Sign out error:", error)
      toast.error("로그아웃 중 오류가 발생했습니다")
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#e8e1d5] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#1f2128]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(109,91,72,0.12),transparent_30%),radial-gradient(circle_at_85%_14%,rgba(116,108,139,0.18),transparent_34%),radial-gradient(circle_at_82%_80%,rgba(95,124,146,0.16),transparent_36%)]" />
        <div className="absolute -top-28 left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-[#d6cbba]/70 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/40 bg-[#ece4d8]/75 px-4 py-3 shadow-[0_16px_34px_-30px_rgba(28,26,22,0.75)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="shrink-0 text-2xl font-black tracking-tight text-[#ef4f42]">V-MATE</div>
            <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
              <button disabled className="cursor-not-allowed text-[#8a8479] transition hover:text-[#5e594f]">
                스토리
              </button>
              <button className="text-[#23262e]">캐릭터</button>
              <button disabled className="cursor-not-allowed text-[#8a8479] transition hover:text-[#5e594f]">
                내 작품
              </button>
              <button disabled className="cursor-not-allowed text-[#8a8479] transition hover:text-[#5e594f]">
                이미지
              </button>
            </nav>

            <div className="ml-auto hidden max-w-sm flex-1 md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d756b]" />
                <Input
                  placeholder="검색어를 입력해 주세요"
                  className="h-10 rounded-full border-[#c8beaf] bg-white/75 pl-9 text-[#2a2b30] placeholder:text-[#847c72] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all focus:border-[#e05d4e] focus:bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="icon" className="rounded-full text-[#7e776d] hover:bg-white/60 hover:text-[#2d2f36]">
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full text-[#7e776d] hover:bg-white/60 hover:text-[#2d2f36]">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:hidden">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d756b]" />
              <Input
                placeholder="검색어를 입력해 주세요"
                className="h-10 rounded-full border-[#c8beaf] bg-white/75 pl-9 text-[#2a2b30] placeholder:text-[#847c72] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all focus:border-[#e05d4e] focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="ml-auto">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="h-8 w-8 cursor-pointer rounded-full bg-gradient-to-tr from-[#9d8ab9] to-[#cba2bb] p-[2px]">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                          alt="User"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-[#cbc2b2] bg-[#f6f2eb]/98 text-[#21232a] shadow-[0_18px_35px_-26px_rgba(28,27,23,0.75)]">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user.user_metadata?.name || "사용자"}</span>
                        <span className="text-xs font-normal text-[#8f8b82]">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-black/10" />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:bg-red-500/10 focus:text-red-500">
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={onAuthRequest}
                  className="rounded-full bg-gradient-to-r from-[#2f3138] to-[#49444f] px-6 text-white shadow-[0_12px_24px_-16px_rgba(23,24,29,0.9)] transition-all hover:brightness-110"
                >
                  로그인
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 py-5 md:py-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {CHARACTER_FILTERS.map((filter) => {
              const isActive = activeFilter === filter
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition md:px-4 ${
                    isActive
                      ? "border-[#f55f53] bg-[#f55f53] text-white shadow-[0_10px_20px_-14px_rgba(245,95,83,0.95)]"
                      : "border-[#d4c8b8] bg-white/70 text-[#635d53] hover:border-[#e5b7b1] hover:text-[#2f3138]"
                  }`}
                >
                  {filter}
                </button>
              )
            })}
          </div>

          {heroCharacters.length > 0 && (
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 md:grid-cols-[1.5fr_1fr_1fr]">
              {heroCharacters.map((char, index) => {
                const meta = CHARACTER_UI_META[char.id]
                const isMainCard = index === 0
                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacterId(char.id)}
                    className={`group relative min-h-[280px] w-[80vw] shrink-0 snap-center overflow-hidden rounded-3xl border border-white/45 text-left shadow-[0_20px_38px_-24px_rgba(26,25,23,0.78)] transition hover:-translate-y-1 hover:shadow-[0_28px_46px_-26px_rgba(26,25,23,0.88)] sm:w-[56vw] md:min-h-[330px] md:w-auto ${
                      isMainCard ? "md:col-span-1" : ""
                    }`}
                  >
                    <img
                      src={char.images.normal}
                      alt={char.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      {meta.badge && (
                        <span className="inline-flex rounded-full bg-[#f75b4f] px-2 py-1 text-[10px] font-semibold tracking-[0.15em]">
                          {meta.badge}
                        </span>
                      )}
                      <h2 className="mt-2 text-2xl font-black leading-tight">{char.name}</h2>
                      <p className="mt-1 text-sm text-white/85">{meta.heroQuote ?? meta.summary}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-[#252730]">캐릭터 모아보기</h3>
            <p className="text-xs font-semibold text-[#7a7469]">좋아요 많은 순</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredCharacters.map((char) => {
              const meta = CHARACTER_UI_META[char.id]
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacterId(char.id)}
                  className="group overflow-hidden rounded-2xl border border-white/45 bg-[#f3ece1]/72 text-left shadow-[0_18px_30px_-22px_rgba(26,25,23,0.72)] transition duration-300 hover:-translate-y-1.5 hover:border-[#e0a69f] hover:shadow-[0_24px_38px_-22px_rgba(26,25,23,0.84)]"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={char.images.normal}
                      alt={char.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-transparent to-transparent" />
                    {meta.badge && (
                      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-white">
                        {meta.badge}
                      </span>
                    )}
                    <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-white/35 bg-black/45 px-2 py-1 text-xs text-white">
                      <Heart className="h-3 w-3" />
                      {meta.likesLabel}
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    <h4 className="text-lg font-bold leading-tight text-[#282a33]">{char.name}</h4>
                    <p className="line-clamp-2 text-sm leading-relaxed text-[#605a50]">{meta.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-md border border-[#dacfbf] bg-white/75 px-2 py-1 text-[11px] font-medium text-[#6b6459]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {filteredCharacters.length === 0 && (
            <div className="py-20 text-center text-[#7f7b74]">검색 결과가 없습니다.</div>
          )}
        </section>
      </main>

      {selectedCharacter && selectedCharacterMeta && (
        <CharacterDetailSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCharacterId(null)
            }
          }}
          character={selectedCharacter}
          meta={selectedCharacterMeta}
          onStartChat={() => onCharacterSelect(selectedCharacter)}
        />
      )}
    </div>
  )
}
