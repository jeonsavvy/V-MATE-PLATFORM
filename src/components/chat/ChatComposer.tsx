import { Send, Sparkles } from "lucide-react"
import type { KeyboardEvent, RefObject } from "react"
import { Button } from "@/components/ui/button"
import { CHAT_REQUEST_LIMITS } from "@/lib/chat/chatContract"

interface ChatComposerProps {
  composerId?: string
  inputValue: string
  isLoading: boolean
  activeEmotionLabel: string
  characterName: string
  quickReplyTemplates: string[]
  messageInputRef: RefObject<HTMLTextAreaElement>
  onInputChange: (value: string) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onQuickReplyClick: (template: string) => void
}

export function ChatComposer({
  composerId,
  inputValue,
  isLoading,
  activeEmotionLabel,
  characterName,
  quickReplyTemplates,
  messageInputRef,
  onInputChange,
  onInputKeyDown,
  onSend,
  onQuickReplyClick,
}: ChatComposerProps) {
  return (
    <div id={composerId} className="border-t border-border/70 bg-background/84 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-5 lg:px-8">
      <div className="mx-auto w-full max-w-[900px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-border/80 bg-card/82 px-4 py-3 shadow-paper">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Message composer
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              {isLoading ? `${characterName}이(가) 답변을 정리하고 있어요.` : `${characterName}에게 다음 장면을 건네보세요.`}
            </p>
          </div>
          <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {activeEmotionLabel}
          </span>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="빠른 답장">
          {quickReplyTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => onQuickReplyClick(template)}
              className="rounded-full border border-border/80 bg-card/82 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-inner-line transition hover:border-primary/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
            >
              {template}
            </button>
          ))}
        </div>

        <div className="rounded-[1.8rem] border border-border/80 bg-card/92 p-3 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <textarea
              ref={messageInputRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={isLoading ? "답변 생성 중입니다..." : "메시지를 입력하세요"}
              aria-label={`${characterName}에게 보낼 메시지`}
              aria-describedby="chat-composer-hint"
              maxLength={CHAT_REQUEST_LIMITS.userMessageMaxChars}
              rows={1}
              className="min-h-[108px] max-h-[180px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-7 text-foreground placeholder:text-muted-foreground outline-none"
            />
            <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
              <div className="text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {inputValue.length}/{CHAT_REQUEST_LIMITS.userMessageMaxChars}
              </div>
              <Button onClick={onSend} disabled={isLoading || !inputValue.trim()} className="min-w-[7.5rem] md:min-w-[8.5rem]">
                <Send className="h-4 w-4" />
                전송
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <p id="chat-composer-hint">Enter 전송 · Shift + Enter 줄바꿈</p>
          </div>
        </div>
      </div>
    </div>
  )
}
