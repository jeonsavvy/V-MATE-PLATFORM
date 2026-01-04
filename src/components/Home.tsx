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
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF007F] to-rose-600 bg-clip-text text-transparent mr-4 hidden md:block">
              V-MATE
            </h1>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="캐릭터 검색..." 
                className="pl-9 bg-neutral-900/90 border-white/10 text-white placeholder:text-neutral-500 focus:bg-neutral-800 transition-all rounded-full h-10"
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
            <Button onClick={onAuthRequest} className="rounded-full bg-[#FF007F] hover:bg-[#E00070] text-white px-6">
              로그인
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
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
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 hover:bg-neutral-800/50 transition-all cursor-pointer hover:border-[#FF007F]/50 hover:shadow-lg hover:shadow-[#FF007F]/20"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img 
                    src={char.images.normal} 
                    alt={char.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
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

