import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, LogOut, Search, Sparkles } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { maskEmailAddress } from "@/lib/privacy"

interface HomeHeaderBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  user: SupabaseUser | null
  userAvatarInitial: string
  onAuthRequest: () => void
  onSignOut: () => void
}

export function HomeHeaderBar({
  searchQuery,
  onSearchChange,
  user,
  userAvatarInitial,
  onAuthRequest,
  onSignOut,
}: HomeHeaderBarProps) {
  const maskedUserEmail = user ? maskEmailAddress(user.email) : ""

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/86 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center gap-3 px-4 py-4 md:flex-nowrap md:gap-5">
        <div className="min-w-0 shrink-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">dual narrative chat</p>
          <div className="font-display text-[clamp(1.45rem,2vw,1.85rem)] text-foreground">V-MATE</div>
        </div>

        <div className="order-3 w-full md:order-none md:flex-1">
          <label className="relative block" htmlFor="home-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="home-search"
              type="search"
              placeholder="캐릭터 이름, 태그, 무드로 찾아보세요"
              className="h-12 rounded-full border-border/80 bg-card/85 pl-11 pr-5 text-sm shadow-inner-line"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="캐릭터 검색"
            />
          </label>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          {!user && (
            <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/75 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              회원 전용 채팅 저장
            </div>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="프로필 메뉴 열기"
                  className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/85 px-2.5 py-1.5 shadow-inner-line transition hover:border-primary/35 hover:bg-card"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary">
                    {userAvatarInitial}
                  </span>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-foreground">{user.user_metadata?.name || "사용자"}</p>
                    <p className="text-xs text-muted-foreground">{maskedUserEmail || "이메일 비공개"}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span>{user.user_metadata?.name || "사용자"}</span>
                    <span className="text-xs font-normal text-muted-foreground">{maskedUserEmail || "이메일 비공개"}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={onAuthRequest} className="px-5">
              로그인
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
