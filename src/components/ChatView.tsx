import { useState, useRef, useEffect } from "react"
import { Character, Message, AIResponse } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Send, ArrowLeft, Trash2 } from "lucide-react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface ChatViewProps {
  character: Character
  onCharacterChange: (charId: string) => void
  user: SupabaseUser | null
  onBack: () => void
}

export function ChatView({ character, onCharacterChange, user, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      role: "assistant",
      content: {
        emotion: "normal",
        inner_heart: "",
        response: character.greeting,
      },
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isLoadingHistoryRef = useRef(false)
  const messagesRef = useRef(messages)
  const getPromptCacheKey = (charId: string) => `gemini_cached_content_${charId}`

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const loadHistory = async () => {
      isLoadingHistoryRef.current = true

      try {
        if (!user) {
          const localKey = `chat_history_${character.id}`
          const saved = localStorage.getItem(localKey)
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              console.log(`Loaded ${parsed.length} messages from localStorage for character ${character.id}`)
              if (parsed.length === 0 || parsed[0].id !== "greeting") {
                setMessages([
                  {
                    id: "greeting",
                    role: "assistant",
                    content: {
                      emotion: "normal",
                      inner_heart: "",
                      response: character.greeting,
                    },
                  },
                  ...parsed,
                ])
              } else {
                const updatedMessages = [...parsed]
                updatedMessages[0] = {
                  id: "greeting",
                  role: "assistant",
                  content: {
                    emotion: "normal",
                    inner_heart: "",
                    response: character.greeting,
                  },
                }
                setMessages(updatedMessages)
              }
            } catch (e) {
              console.error("Failed to parse local history", e)
              setMessages([
                {
                  id: "greeting",
                  role: "assistant",
                  content: {
                    emotion: "normal",
                    inner_heart: "",
                    response: character.greeting,
                  },
                },
              ])
            }
          } else {
            console.log(`No saved messages found in localStorage for character ${character.id}`)
            setMessages([
              {
                id: "greeting",
                role: "assistant",
                content: {
                  emotion: "normal",
                  inner_heart: "",
                  response: character.greeting,
                },
              },
            ])
          }
        } else {
          if (!isSupabaseConfigured()) {
            console.warn("Supabase is not configured, cannot load chat history for logged in user")
            setMessages([
              {
                id: "greeting",
                role: "assistant",
                content: {
                  emotion: "normal",
                  inner_heart: "",
                  response: character.greeting,
                },
              },
            ])
            return
          }

          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            console.warn("No session found, cannot load chat history for logged in user")
            setMessages([
              {
                id: "greeting",
                role: "assistant",
                content: {
                  emotion: "normal",
                  inner_heart: "",
                  response: character.greeting,
                },
              },
            ])
            return
          }

          console.log(`Loading chat history for user ${user.id}, character ${character.id}`)
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', user.id)
            .eq('character_id', character.id)
            .order('created_at', { ascending: true })

          if (error) {
            console.error("Supabase query error:", error)
            throw error
          }

          console.log(`Loaded ${data?.length || 0} messages from Supabase for user ${user.id}, character ${character.id}`)
          if (data && data.length > 0) {
            console.log("Raw data from Supabase:", data)
          }

          if (data && data.length > 0) {
            const loadedMessages: Message[] = data.map((msg: any) => {
              try {
                const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
                return {
                  id: msg.id,
                  role: msg.role as "user" | "assistant",
                  content: content,
                  timestamp: msg.created_at,
                }
              } catch (e) {
                console.error("Failed to parse message content:", msg, e)
                return {
                  id: msg.id,
                  role: msg.role as "user" | "assistant",
                  content: typeof msg.content === 'string' ? msg.content : msg.content,
                  timestamp: msg.created_at,
                }
              }
            })

            console.log(`Parsed ${loadedMessages.length} messages`)

            if (loadedMessages.length === 0 || loadedMessages[0].id !== "greeting") {
              setMessages([
                {
                  id: "greeting",
                  role: "assistant",
                  content: {
                    emotion: "normal",
                    inner_heart: "",
                    response: character.greeting,
                  },
                },
                ...loadedMessages,
              ])
            } else {
              const updatedMessages = [...loadedMessages]
              if (updatedMessages[0]?.id === "greeting") {
                updatedMessages[0] = {
                  id: "greeting",
                  role: "assistant",
                  content: {
                    emotion: "normal",
                    inner_heart: "",
                    response: character.greeting,
                  },
                }
              }
              setMessages(updatedMessages)
            }
          } else {
            console.log("No messages found in Supabase, showing greeting only")
            setMessages([
              {
                id: "greeting",
                role: "assistant",
                content: {
                  emotion: "normal",
                  inner_heart: "",
                  response: character.greeting,
                },
              },
            ])
          }
        }
      } catch (error) {
        console.error("Failed to load chat history", error)
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: {
              emotion: "normal",
              inner_heart: "",
              response: character.greeting,
            },
          },
        ])
      } finally {
        isLoadingHistoryRef.current = false
      }
    }

    loadHistory()
  }, [user, character.id])

  useEffect(() => {
    if (isLoadingHistoryRef.current) {
      console.log("Skipping save: history is loading")
      return
    }

    if (!user && messages.length > 1) {
      const localKey = `chat_history_${character.id}`
      const messagesToSave = messages.filter(msg => msg.id !== "greeting")
      if (messagesToSave.length > 0) {
        try {
          localStorage.setItem(localKey, JSON.stringify(messagesToSave))
          console.log(`Saved ${messagesToSave.length} messages to localStorage for character ${character.id}`)
        } catch (e) {
          console.error("Failed to save to localStorage", e)
        }
      }
    }
  }, [messages, user, character.id])

  useEffect(() => {
    if (user) return // 로그인 사용자는 제외

    const handleBeforeUnload = () => {
      if (messagesRef.current.length > 1) {
        const localKey = `chat_history_${character.id}`
        const messagesToSave = messagesRef.current.filter(msg => msg.id !== "greeting")
        if (messagesToSave.length > 0) {
          try {
            localStorage.setItem(localKey, JSON.stringify(messagesToSave))
          } catch (e) {
            console.error("Failed to save to localStorage on unload", e)
          }
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      handleBeforeUnload()
    }
  }, [user, character.id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])

    if (user) {
      void saveMessage(userMessage)
    }

    setInputValue("")
    setIsLoading(true)

    try {
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : msg.content.response,
      }))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      let response
      const cacheStorageKey = getPromptCacheKey(character.id)
      const cachedContent = localStorage.getItem(cacheStorageKey)
      try {
        response = await fetch("/.netlify/functions/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            characterId: character.id,
            systemPrompt: character.system,
            userMessage: text,
            messageHistory: messageHistory.slice(1), // greeting 제외
            cachedContent: cachedContent || undefined,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === "AbortError") {
          throw new Error("응답 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.")
        } else if (fetchError.message.includes("Failed to fetch")) {
          throw new Error("서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.")
        }
        throw fetchError
      }

      if (!response.ok) {
        let errorMessage = "서버 오류가 발생했습니다."
        let errorCode = ""
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          errorCode = errorData.error_code || ""
          if (errorMessage.includes("API key") || errorMessage.includes("GOOGLE_API_KEY")) {
            errorMessage = "API 키가 설정되지 않았거나 만료되었습니다. 관리자에게 문의해주세요."
          } else if (
            errorCode === "UPSTREAM_CONNECTION_FAILED" ||
            errorCode === "UPSTREAM_TIMEOUT" ||
            errorMessage.includes("Failed to connect to Gemini API") ||
            errorMessage.includes("temporarily unavailable") ||
            errorMessage.includes("overloaded")
          ) {
            errorMessage = "현재 AI 서버 연결이 불안정합니다. 잠시 후 다시 시도해주세요."
          }
        } catch (e) {
          if (response.status === 500) {
            errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          } else if (response.status === 503) {
            errorMessage = "서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      if (Object.prototype.hasOwnProperty.call(data, "cachedContent")) {
        if (typeof data.cachedContent === "string" && data.cachedContent.trim()) {
          localStorage.setItem(cacheStorageKey, data.cachedContent.trim())
        } else if (data.cachedContent === null) {
          localStorage.removeItem(cacheStorageKey)
        }
      }
      if (!data.text) {
        throw new Error("서버로부터 응답을 받지 못했습니다. 다시 시도해주세요.")
      }

      const rawText = data.text
      const jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "").trim()

      let parsed: AIResponse
      try {
        parsed = JSON.parse(jsonStr)
        if (!parsed.emotion || !parsed.response) {
          throw new Error("응답 형식이 올바르지 않습니다.")
        }
      } catch (parseError) {
        parsed = {
          emotion: "normal",
          inner_heart: "음... 뭔가 이상한데?",
          response:
            character.id === "mika"
              ? "선생님... 잠깐만, 뭔가 이상한 기분이 드는데? 다시 말해줄 수 있어?"
              : character.id === "alice"
                ? "흠, 무언가 오류가 있었던 것 같다. 다시 한 번 말해달라."
                : "어? 뭔가 꼬인 것 같은데... 다시 말해봐.",
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: parsed,
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (user) {
        void saveMessage(assistantMessage)
      }
    } catch (err: any) {
      let parsed: AIResponse
      const errorMsg = err.message || "알 수 없는 오류가 발생했습니다."

      if (errorMsg.includes("네트워크") || errorMsg.includes("연결")) {
        parsed = {
          emotion: "normal",
          inner_heart:
            character.id === "mika"
              ? "선생님 기다리게 했지... 이번엔 제대로 집중해서 들을게."
              : character.id === "alice"
                ? "통신이 잠시 흔들렸군... 다시 맞춰보자."
                : "신호가 잠깐 튄 듯.",
          response:
            character.id === "mika"
              ? "선생님, 방금 신호가 잠깐 흔들렸어. 한 번만 다시 말해줘. ☆"
              : character.id === "alice"
                ? "통신이 일시적으로 불안정했다. 같은 내용을 다시 전해주겠는가."
                : "지금 신호 잠깐 튐. 다시 한 번만.",
        }
      } else if (errorMsg.includes("API 키") || errorMsg.includes("만료")) {
        parsed = {
          emotion: "normal",
          inner_heart: "서버 쪽에 문제가 있는 것 같다...",
          response:
            character.id === "mika"
              ? "선생님... 뭔가 문제가 있는 것 같아. 나중에 다시 말해줄 수 있어?"
              : character.id === "alice"
                ? "시스템에 문제가 발생했다. 잠시 후 다시 시도해달라."
                : "서버 쪽 문제인 것 같은데... 나중에 다시 말해줘.",
        }
      } else if (errorMsg.includes("시간이 초과")) {
        parsed = {
          emotion: "normal",
          inner_heart: "시간이 오래 걸리는구나...",
          response:
            character.id === "mika"
              ? "선생님... 응답이 좀 느린 것 같은데? 다시 말해줄 수 있어?"
              : character.id === "alice"
                ? "응답이 지연되고 있다. 잠시 후 다시 시도해달라."
                : "응답이 좀 느린 것 같은데... 다시 말해봐.",
        }
      } else {
        parsed = {
          emotion: "normal",
          inner_heart:
            character.id === "mika"
              ? "뭔가 이상한데... 선생님한테는 보여주고 싶지 않은데..."
              : character.id === "alice"
                ? "오류가 발생했다. 다시 시도해보자."
                : "어? 뭔가 이상한데...",
          response:
            character.id === "mika"
              ? "선생님... 잠깐만, 뭔가 이상한 기분이 드는데? 다시 말해줄 수 있어?"
              : character.id === "alice"
                ? "예상치 못한 오류가 발생했다. 다시 한 번 말해달라."
                : "어? 뭔가 꼬인 것 같은데... 다시 말해봐.",
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: parsed,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const saveMessage = async (msg: Message) => {
    if (!user || !isSupabaseConfigured()) {
      console.log("Cannot save message: no user or supabase not configured")
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log("Cannot save message: no session")
        return
      }

      const contentToSave = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          character_id: character.id,
          role: msg.role,
          content: contentToSave,
        })
        .select()

      if (error) {
        console.error("Failed to save message to Supabase:", error)
        throw error
      }

      console.log("Message saved successfully:", data?.[0]?.id)
    } catch (error) {
      console.error("Failed to save message", error)
    }
  }

  const handleClearChat = async () => {
    if (!confirm("정말로 대화를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return
    }

    if (user) {
      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const { error } = await supabase
              .from('chat_messages')
              .delete()
              .eq('user_id', user.id)
              .eq('character_id', character.id)

            if (error) throw error
          }
        } catch (error) {
          console.error("Failed to clear chat", error)
          alert("대화 초기화에 실패했습니다. 다시 시도해주세요.")
          return
        }
      }
    } else {
      const localKey = `chat_history_${character.id}`
      localStorage.removeItem(localKey)
    }

    setMessages([
      {
        id: "greeting",
        role: "assistant",
        content: {
          emotion: "normal",
          inner_heart: "",
          response: character.greeting,
        },
      },
    ])
  }

  const currentEmotion = messages.length > 0 && typeof messages[messages.length - 1].content !== "string"
    ? (messages[messages.length - 1].content as AIResponse).emotion
    : "normal"

  let imageKey: keyof typeof character.images = "normal"
  if (currentEmotion === "confused" && character.images.confused) {
    imageKey = "confused"
  } else if (currentEmotion === "happy" && character.images.happy) {
    imageKey = "happy"
  } else if (currentEmotion === "angry") {
    imageKey = "angry"
  } else if (currentEmotion === "normal") {
    imageKey = "normal"
  }

  const characterImage = character.images[imageKey] || character.images.normal

  return (
    <div className="relative h-screen overflow-hidden bg-[#ece9e1] text-[#22242b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(160,148,178,0.18),transparent_32%),radial-gradient(circle_at_88%_85%,rgba(178,192,206,0.14),transparent_36%)]" />

      <div className="relative z-10 mx-auto grid h-full max-w-[1400px] lg:grid-cols-[360px_1fr]">
        <aside className="hidden border-r border-black/10 bg-[#ece9e1]/60 p-6 lg:flex lg:flex-col">
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/70 shadow-[0_20px_40px_-30px_rgba(32,34,41,0.45)]">
            <img src={characterImage} alt={character.name} className="aspect-[4/5] w-full object-cover object-top" />
            <div className="border-t border-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8f8b82]">interactive persona</p>
              <p className="mt-2 text-xl font-black text-[#2f3138]">{character.name}</p>
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-black/10 bg-white/70 p-4 text-xs text-[#77736b]">
            감정과 속마음이 분리되어 표시됩니다.
          </div>
        </aside>

        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-black/10 bg-[#f5f1e9]/85 p-4 backdrop-blur-xl lg:p-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-[#666259] hover:bg-black/5 hover:text-[#2f3138]"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                <span className="hidden sm:inline">홈으로</span>
              </Button>
              <div className="lg:hidden">
                <p className="text-sm font-bold text-[#2f3138]">{character.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleClearChat}
                className="text-[#7a756d] hover:bg-red-500/10 hover:text-red-500"
                title="대화 초기화"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <select
                value={character.id}
                onChange={(e) => onCharacterChange(e.target.value)}
                className="cursor-pointer rounded-lg border border-black/10 bg-white/80 px-4 py-2 text-xs uppercase tracking-wider text-[#5f635f] outline-none transition hover:bg-white focus:border-[#9d8ab9]"
              >
                <option value="mika">Misono Mika</option>
                <option value="alice">Alice Zuberg</option>
                <option value="kael">Kael</option>
              </select>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto p-4 scroll-smooth lg:p-8"
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user"
              const content = typeof msg.content === "string" ? msg.content : msg.content.response
              const innerHeart = typeof msg.content === "string" ? null : msg.content.inner_heart

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "fade-in flex w-full",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex max-w-[88%] gap-3 md:max-w-[70%]",
                      isUser ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {!isUser && (
                      <Avatar
                        src={characterImage}
                        alt={character.name}
                        fallback={character.name[0]}
                        className="size-10 shrink-0 border border-black/10 object-cover object-top"
                      />
                    )}

                    <div
                      className={cn(
                        "rounded-2xl p-4 text-sm leading-relaxed shadow-[0_14px_26px_-20px_rgba(34,35,43,0.35)]",
                        isUser
                          ? "rounded-br-sm bg-[#3d3f48] text-[#f8f7f4]"
                          : "rounded-bl-sm border border-black/10 bg-white/82 text-[#2a2d35] backdrop-blur-md"
                      )}
                    >
                      {!isUser && innerHeart && (
                        <div className="mb-3 rounded-xl border border-[#dbccd9] bg-[#f7edf5] p-3 text-xs font-semibold text-[#7a5671]">
                          💭 {innerHeart}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{content}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {isLoading && (
              <div className="fade-in flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-black/10 bg-white/82 px-5 py-3 text-xs text-[#7b766d]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f8aa8] [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f8aa8] [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f8aa8]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-t from-[#ece9e1] via-[#ece9e1]/95 to-transparent p-4 pb-8 lg:p-6">
            <div className="mx-auto max-w-4xl rounded-2xl border border-black/10 bg-white/85 p-2 shadow-[0_16px_30px_-20px_rgba(42,45,53,0.45)] backdrop-blur-xl">
              <div className="flex items-center gap-2 pl-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="메시지를 입력하세요"
                  disabled={isLoading}
                  className="h-10 flex-1 border-0 bg-transparent text-[#2a2c34] placeholder:text-[#8d887f] focus-visible:ring-0"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  className="size-10 shrink-0 rounded-xl bg-[#3b3e47] text-white hover:bg-[#2f3138]"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
