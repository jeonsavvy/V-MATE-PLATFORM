import { useState } from "react"
import { motion } from "motion/react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { type AIResponse, type Character } from "@/lib/data"
import { CHARACTER_UI_META } from "@/lib/character-ui"
import { cn } from "@/lib/utils"
import { useChatViewController } from "@/hooks/useChatViewController"
import { ChatComposer } from "@/components/chat/ChatComposer"
import { CharacterInfoDesktop } from "@/components/chat/CharacterInfoDesktop"
import { CharacterInfoMobile } from "@/components/chat/CharacterInfoMobile"
import { CharacterSidebar } from "@/components/chat/CharacterSidebar"
import { ChatTopBar } from "@/components/chat/ChatTopBar"
import { MessageTimeline } from "@/components/chat/MessageTimeline"
import { ClearChatDialog } from "@/components/chat/ClearChatDialog"

interface ChatViewProps {
  character: Character
  onCharacterChange: (charId: string) => void
  user: SupabaseUser | null
  onBack: () => void
}

const EMOTION_LABELS: Record<AIResponse["emotion"], string> = {
  normal: "차분한 호흡",
  happy: "감정이 풀린 상태",
  confused: "리듬이 흔들린 순간",
  angry: "감정이 고조된 순간",
}

const QUICK_REPLY_TEMPLATES = ["계속 말해줘", "조금 더 자세히 알려줘", "다른 전개로 이어가줘"]

export function ChatView({ character, onCharacterChange, user, onBack }: ChatViewProps) {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isClearSubmitting, setIsClearSubmitting] = useState(false)

  const {
    inputValue,
    setInputValue,
    isLoading,
    showEmotionIllustrations,
    setShowEmotionIllustrations,
    isInfoPanelOpen,
    setIsInfoPanelOpen,
    scrollRef,
    messageInputRef,
    sidebarCharacterEntries,
    preparedMessages,
    activeEmotion,
    handleSendMessage,
    handleClearChat,
    handleInputKeyDown,
    handleQuickReplyClick,
  } = useChatViewController({ character, user })

  const characterMeta = CHARACTER_UI_META[character.id]
  const activeEmotionLabel = EMOTION_LABELS[activeEmotion]

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#chat-message-list"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        메시지 영역으로 건너뛰기
      </a>
      <a
        href="#chat-composer"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-16 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        입력 영역으로 건너뛰기
      </a>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,92,184,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(214,157,170,0.12),transparent_28%)]" />
        <div className="paper-grid absolute inset-0 opacity-[0.16]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative z-10 mx-auto grid h-dvh w-full max-w-[1580px] lg:grid-cols-[280px_minmax(0,1fr)]",
          isInfoPanelOpen && "xl:grid-cols-[280px_minmax(0,1fr)_340px]"
        )}
      >
        <CharacterSidebar
          entries={sidebarCharacterEntries}
          activeCharacterId={character.id}
          onCharacterChange={onCharacterChange}
        />

        <div className="flex h-full min-h-0 min-w-0 flex-col border-x border-border/70 bg-background/72 backdrop-blur-sm lg:border-r-0">
          <ChatTopBar
            character={character}
            characterTags={characterMeta.tags}
            isInfoPanelOpen={isInfoPanelOpen}
            onBack={onBack}
            onToggleInfoPanel={() => setIsInfoPanelOpen((prev) => !prev)}
            onClearChat={() => setIsClearDialogOpen(true)}
            onCharacterChange={onCharacterChange}
          />

          <CharacterInfoMobile
            isOpen={isInfoPanelOpen}
            character={character}
            tags={characterMeta.tags}
            summary={characterMeta.summary}
            activeEmotionLabel={activeEmotionLabel}
            showEmotionIllustrations={showEmotionIllustrations}
            onToggleIllustrations={() => setShowEmotionIllustrations((prev) => !prev)}
          />

          <MessageTimeline
            timelineId="chat-message-list"
            scrollRef={scrollRef}
            preparedMessages={preparedMessages}
            characterName={character.name}
            isLoading={isLoading}
            emotionLabels={EMOTION_LABELS}
          />

          <ChatComposer
            composerId="chat-composer"
            inputValue={inputValue}
            isLoading={isLoading}
            activeEmotionLabel={activeEmotionLabel}
            characterName={character.name}
            quickReplyTemplates={QUICK_REPLY_TEMPLATES}
            messageInputRef={messageInputRef}
            onInputChange={setInputValue}
            onInputKeyDown={handleInputKeyDown}
            onSend={() => {
              void handleSendMessage()
            }}
            onQuickReplyClick={handleQuickReplyClick}
          />
        </div>

        <CharacterInfoDesktop
          isOpen={isInfoPanelOpen}
          character={character}
          tags={characterMeta.tags}
          summary={characterMeta.summary}
          heroQuote={characterMeta.heroQuote}
          activeEmotionLabel={activeEmotionLabel}
          showEmotionIllustrations={showEmotionIllustrations}
          onToggleIllustrations={() => setShowEmotionIllustrations((prev) => !prev)}
        />
      </motion.div>

      <ClearChatDialog
        open={isClearDialogOpen}
        isSubmitting={isClearSubmitting}
        onOpenChange={setIsClearDialogOpen}
        onConfirm={() => {
          void (async () => {
            setIsClearSubmitting(true)
            const success = await handleClearChat()
            setIsClearSubmitting(false)
            if (success) {
              setIsClearDialogOpen(false)
            }
          })()
        }}
      />
    </div>
  )
}
