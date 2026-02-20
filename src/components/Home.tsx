import { useState } from "react"
import { Character, CHARACTERS } from "@/lib/data"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Search, LogOut } from "lucide-react"
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

interface HomeProps {
  onCharacterSelect: (character: Character) => void
  user: SupabaseUser | null
  onAuthRequest: () => void
}

export function Home({ onCharacterSelect, user, onAuthRequest }: HomeProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const characters = Object.values(CHARACTERS)

  const filteredCharacters = characters.filter((char) => {
    return char.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

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
    <div className="relative min-h-screen overflow-hidden bg-[#f3f0e8] pb-20 text-[#1f2128]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-[#d8cfbf]/70 blur-[120px]" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#d4c8da]/45 blur-[110px]" />
        <div className="absolute -right-24 bottom-12 h-80 w-80 rounded-full bg-[#c7d4df]/35 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f3f0e8]/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="flex flex-1 items-center gap-2">
            <h1 className="mr-4 text-xl font-black tracking-tight text-[#2b2c31]">
              <span className="md:hidden">V-MATE</span>
              <span className="hidden md:inline">V-MATE</span>
            </h1>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f8b82]" />
              <Input
                placeholder="캐릭터 검색..."
                className="h-10 rounded-full border-black/10 bg-white/80 pl-9 text-[#2a2b30] placeholder:text-[#8f8b82] transition-all focus:border-[#9d8ab9] focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

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
              <DropdownMenuContent align="end" className="border-black/10 bg-white text-[#21232a]">
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
              className="rounded-full bg-[#2f3138] px-6 text-white hover:bg-[#1f2026]"
            >
              로그인
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="rounded-3xl border border-black/10 bg-white/75 p-6 shadow-[0_22px_70px_-45px_rgba(40,41,49,0.55)] backdrop-blur-xl md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8f8b82]">interactive persona</p>
          <h2 className="mt-3 text-2xl font-black leading-tight text-[#252730] md:text-4xl">
            감정과 속마음이 보이는
            <br className="hidden md:block" /> 몰입형 캐릭터 채팅
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[#5b5f69] md:text-base">
            캐릭터별 페르소나 프롬프트와 감정 반응 UI를 결합해 텍스트 이상의 상호작용을 제공합니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#86817a]">character</p>
              <p className="mt-2 text-2xl font-bold text-[#262830]">{characters.length}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#86817a]">mode</p>
              <p className="mt-2 text-2xl font-bold text-[#262830]">Dual-Psych</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#86817a]">session</p>
              <p className="mt-2 text-2xl font-bold text-[#262830]">{user ? "Signed" : "Guest"}</p>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#252730]">캐릭터 선택</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredCharacters.map((char) => (
              <div
                key={char.id}
                onClick={() => onCharacterSelect(char)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-black/10 bg-white/80 transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-2xl hover:shadow-black/10"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={char.images.normal}
                    alt={char.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <span className="mb-2 inline-flex rounded-full border border-white/40 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                      persona
                    </span>
                    <h3 className="text-lg font-bold leading-none">{char.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCharacters.length === 0 && (
            <div className="py-20 text-center text-[#7f7b74]">검색 결과가 없습니다.</div>
          )}
        </div>
      </main>
    </div>
  )
}
