import { motion } from "motion/react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { Character } from "@/lib/data"
import {
  formatRelativeTime,
  HERO_SIGNALS,
  STORY_FLOW_STEPS,
  useHomeController,
} from "@/hooks/useHomeController"
import { CharacterDetailSheet } from "./CharacterDetailSheet"
import { HomeHeaderBar } from "@/components/home/HomeHeaderBar"
import { HomeHeroSection } from "@/components/home/HomeHeroSection"
import { HomeStoryFlowSection } from "@/components/home/HomeStoryFlowSection"
import { HomeCuratedPicksSection } from "@/components/home/HomeCuratedPicksSection"
import { HomeCharacterBrowseSection } from "@/components/home/HomeCharacterBrowseSection"

interface HomeProps {
  onCharacterSelect: (character: Character) => void
  user: SupabaseUser | null
  onAuthRequest: () => void
}

export function Home({ onCharacterSelect, user, onAuthRequest }: HomeProps) {
  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    setSelectedCharacterId,
    recentChats,
    filteredCharacters,
    heroCharacters,
    primaryCharacter,
    primaryCharacterMeta,
    recentContinuation,
    selectedCharacter,
    selectedCharacterMeta,
    userAvatarInitial,
    handleSignOut,
    characterFilters,
  } = useHomeController({ user })

  return (
    <div className="relative min-h-dvh overflow-hidden text-foreground">
      <a
        href="#home-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="paper-grid absolute inset-0 opacity-[0.22]" />
        <div className="absolute left-[-10%] top-[-10%] h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <HomeHeaderBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        user={user}
        userAvatarInitial={userAvatarInitial}
        onAuthRequest={onAuthRequest}
        onSignOut={handleSignOut}
      />

      <main id="home-main-content" className="relative z-10 mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-4 pb-16 pt-6 md:pt-8 lg:gap-8">
        <HomeHeroSection
          primaryCharacter={primaryCharacter}
          primaryHeroQuote={primaryCharacterMeta?.heroQuote ?? primaryCharacter.greeting}
          primaryObjectPosition={primaryCharacterMeta?.heroObjectPosition}
          recentChatsCount={recentChats.length}
          recentContinuation={recentContinuation}
          onCharacterSelect={onCharacterSelect}
          onSelectCharacterDetail={setSelectedCharacterId}
          formatRelativeTime={formatRelativeTime}
        />

        <HomeStoryFlowSection steps={STORY_FLOW_STEPS} />

        <HomeCuratedPicksSection
          heroCharacters={heroCharacters}
          heroSignals={HERO_SIGNALS}
          onSelectCharacterDetail={setSelectedCharacterId}
        />

        <HomeCharacterBrowseSection
          filteredCharacters={filteredCharacters}
          characterFilters={characterFilters}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onSelectCharacterDetail={setSelectedCharacterId}
        />
      </main>

      <footer className="relative z-10 border-t border-border/70 bg-background/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          className="mx-auto flex w-full max-w-[1380px] flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1">
            <p className="font-display text-xl text-foreground">V-MATE</p>
            <p>감정 변화와 속마음을 함께 읽는 캐릭터 대화실.</p>
          </div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em]">3 curated personas · 로그인 동기화 · 서버 측 AI 프록시</p>
        </motion.div>
      </footer>

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
