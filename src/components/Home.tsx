import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { platformApi } from '@/lib/platform/apiClient'
import type { HomeFeedPayload } from '@/lib/platform/types'
import { EmptyState, EntityCard, FilterChip, PageSection, PlatformShell } from '@/components/platform/PlatformScaffold'

interface HomeProps {
  user: SupabaseUser | null
  userAvatarInitial: string
  searchQuery: string
  onSearchChange: (value: string) => void
  onNavigate: (path: string) => void
  onAuthRequest: () => void
  onSignOut: () => void
}

export function Home({ user, userAvatarInitial, searchQuery, onSearchChange, onNavigate, onAuthRequest, onSignOut }: HomeProps) {
  void user
  void onAuthRequest
  const [filter, setFilter] = useState<'new' | 'popular' | ''>('')
  const [homePayload, setHomePayload] = useState<HomeFeedPayload | null>(null)

  useEffect(() => {
    let mounted = true
    void platformApi.fetchHome('characters', searchQuery, filter)
      .then((data) => { if (mounted) setHomePayload(data) })
      .catch((error) => toast.error(error instanceof Error ? error.message : '홈을 불러오지 못했습니다.'))
    return () => { mounted = false }
  }, [filter, searchQuery])

  const characterItems = homePayload?.home.characterFeed.items || []
  const worldItems = homePayload?.home.worldFeed.items || []

  return (
    <PlatformShell
      user={user}
      userAvatarInitial={userAvatarInitial}
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      onNavigate={onNavigate}
      onAuthRequest={onAuthRequest}
      onSignOut={onSignOut}
    >
      <div className="space-y-6" data-footer-copy="© V-MATE">
        <PageSection title="둘러보기">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === 'new'} onClick={() => setFilter((prev) => prev === 'new' ? '' : 'new')}>신작</FilterChip>
            <FilterChip active={filter === 'popular'} onClick={() => setFilter((prev) => prev === 'popular' ? '' : 'popular')}>인기</FilterChip>
          </div>
        </PageSection>

        <PageSection title="캐릭터 둘러보기">
          {characterItems.length === 0 ? (
            <EmptyState title="캐릭터가 없습니다" description="검색어나 필터를 바꿔 다시 확인해보세요." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {characterItems.map((item) => (
                <EntityCard
                  key={`${item.entityType}-${item.id}`}
                  item={item}
                  onClick={() => onNavigate(`/characters/${item.slug}`)}
                />
              ))}
            </div>
          )}
        </PageSection>

        <PageSection title="월드 둘러보기">
          {worldItems.length === 0 ? (
            <EmptyState title="월드가 없습니다" description="검색어나 필터를 바꿔 다시 확인해보세요." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {worldItems.map((item) => (
                <EntityCard
                  key={`${item.entityType}-${item.id}`}
                  item={item}
                  onClick={() => onNavigate(`/worlds/${item.slug}`)}
                />
              ))}
            </div>
          )}
        </PageSection>
      </div>
    </PlatformShell>
  )
}
