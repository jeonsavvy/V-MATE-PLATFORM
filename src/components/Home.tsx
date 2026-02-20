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
    <div className="relative min-h-screen overflow-hidden bg-[#05050A] pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-[110px]" />
        <div className="absolute -right-24 bottom-12 h-80 w-80 rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <h1 className="mr-4 bg-gradient-to-r from-[#FF007F] via-fuchsia-400 to-violet-400 bg-clip-text text-xl font-black tracking-tight text-transparent">
              <span className="md:hidden">V-MATE</span>
              <span className="hidden md:inline">V-MATE</span>
            </h1>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="캐릭터 검색..."
                className="h-10 rounded-full border-white/10 bg-neutral-900/80 pl-9 text-white placeholder:text-neutral-500 transition-all focus:border-fuchsia-400/40 focus:bg-neutral-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400 p-[2px] cursor-pointer">
                  <div className="h-full w-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                      alt="User"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800 text-white">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.user_metadata?.name || '사용자'}</span>
                    <span className="text-xs text-gray-400 font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-800" />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 focus:text-red-300 focus:bg-red-500/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={onAuthRequest}
              className="rounded-full bg-gradient-to-r from-[#FF007F] to-fuchsia-500 px-6 text-white shadow-lg shadow-fuchsia-600/20 hover:from-[#E00070] hover:to-fuchsia-600"
            >
              로그인
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#171725]/75 via-[#0D0D17]/70 to-[#121228]/70 p-6 shadow-[0_24px_80px_-35px_rgba(232,53,151,0.45)] backdrop-blur-xl md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300/90">interactive persona</p>
          <h2 className="mt-3 text-2xl font-black leading-tight text-white md:text-4xl">
            감정과 속마음이 보이는
            <br className="hidden md:block" /> 몰입형 캐릭터 채팅
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-neutral-300 md:text-base">
            캐릭터별 페르소나 프롬프트와 감정 반응 UI를 결합해 텍스트 이상의 상호작용을 제공합니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">character</p>
              <p className="mt-2 text-2xl font-bold text-white">{characters.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">mode</p>
              <p className="mt-2 text-2xl font-bold text-white">Dual-Psych</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">session</p>
              <p className="mt-2 text-2xl font-bold text-white">{user ? "Signed" : "Guest"}</p>
            </div>
          </div>
        </section>

        {/* Character Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">캐릭터 선택</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCharacters.map((char) => (
              <div
                key={char.id}
                onClick={() => onCharacterSelect(char)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 transition-all duration-300 hover:-translate-y-1.5 hover:border-fuchsia-400/45 hover:shadow-2xl hover:shadow-fuchsia-500/25"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={char.images.normal}
                    alt={char.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <span className="mb-2 inline-flex rounded-full border border-fuchsia-300/40 bg-fuchsia-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
                      persona
                    </span>
                    <h3 className="text-lg font-bold leading-none">{char.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCharacters.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
