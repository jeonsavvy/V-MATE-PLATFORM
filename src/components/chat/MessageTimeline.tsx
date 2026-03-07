import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Heart } from "lucide-react"
import type { RefObject } from "react"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { AIResponse } from "@/lib/data"
import type { PreparedChatMessage } from "@/lib/chat/messagePresentation"

interface MessageTimelineProps {
  timelineId?: string
  scrollRef: RefObject<HTMLDivElement>
  preparedMessages: PreparedChatMessage[]
  characterName: string
  isLoading: boolean
  emotionLabels: Record<AIResponse["emotion"], string>
}

export function MessageTimeline({
  timelineId,
  scrollRef,
  preparedMessages,
  characterName,
  isLoading,
  emotionLabels,
}: MessageTimelineProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      id={timelineId}
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-8 lg:py-6"
    >
      <div className="mx-auto w-full max-w-[900px] space-y-5 pb-3">
        <div className="rounded-[1.8rem] border border-border/80 bg-card/82 px-4 py-4 shadow-paper sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Session log</p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">이 대화는 AI로 생성된 가상의 장면이며, 겉말과 속마음을 분리해서 보여줍니다.</p>
            </div>
            <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              dual psychology mode
            </span>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {preparedMessages.map(({ msg, isUser, content, innerHeart, narration, emotion, showIllustrationCard, messageImage }) => {
            const bubbleAnimation = prefersReducedMotion
              ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
              : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } }

            return (
              <motion.article
                key={msg.id}
                layout={!prefersReducedMotion}
                {...bubbleAnimation}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                aria-label={isUser ? "내 메시지" : `${characterName} 메시지`}
                className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
              >
                <div className={cn("flex w-full gap-3", isUser ? "max-w-[44rem] flex-row-reverse" : "max-w-[48rem]")}
                >
                  {!isUser && (
                    <Avatar
                      src={messageImage}
                      alt={characterName}
                      fallback={characterName[0]}
                      className="mt-1 size-10 rounded-[1rem] border border-border/80 object-cover object-top"
                    />
                  )}

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className={cn("flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em]", isUser ? "justify-end text-muted-foreground" : "text-muted-foreground")}
                    >
                      <span>{isUser ? "me" : characterName}</span>
                      {!isUser && emotion && (
                        <span className="rounded-full border border-border/70 bg-card px-2 py-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                          {emotionLabels[emotion]}
                        </span>
                      )}
                    </div>

                    {showIllustrationCard && emotion && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="overflow-hidden rounded-[1.8rem] border border-border/80 bg-card shadow-panel"
                      >
                        <img
                          src={messageImage}
                          alt={`${characterName} ${emotion}`}
                          className="h-[260px] w-full object-cover object-top sm:h-[340px]"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{characterName}</span>
                          <span className="rounded-full border border-border/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                            {emotionLabels[emotion]}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {!isUser && narration && (
                      <div className="rounded-[1.45rem] border border-border/80 bg-secondary/42 px-4 py-3 shadow-inner-line">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scene</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{narration}</p>
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-[1.75rem] border px-4 py-4 shadow-paper sm:px-5",
                        isUser
                          ? "rounded-br-[0.6rem] border-[#201917] bg-[#1d1714] text-[#f9f5ee]"
                          : "rounded-bl-[0.6rem] border-border/80 bg-card/94 text-foreground"
                      )}
                    >
                      {!isUser && innerHeart && (
                        <div className="mb-4 rounded-[1.4rem] border border-primary/18 bg-primary/[0.05] px-4 py-3 shadow-inner-line">
                          <div className="mb-2 inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/75">
                            <Heart className="h-3.5 w-3.5" />
                            inner heart
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/82">{innerHeart}</p>
                        </div>
                      )}
                      <div className={cn("whitespace-pre-wrap break-words text-[15px] leading-7", isUser ? "text-[#f9f5ee]" : "text-foreground")}>{content}</div>
                    </div>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-[1.45rem] border border-border/80 bg-card/92 px-4 py-3 shadow-paper">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/80 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/65" />
                </div>
                <span className="font-medium">{characterName}이(가) 장면을 정리하고 있어요.</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
