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
      try {
        response = await fetch("/.netlify/functions/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemPrompt: character.system,
            userMessage: text,
            messageHistory: messageHistory.slice(1), // greeting 제외
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
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          if (errorMessage.includes("API key") || errorMessage.includes("GOOGLE_API_KEY")) {
            errorMessage = "API 키가 설정되지 않았거나 만료되었습니다. 관리자에게 문의해주세요."
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
              ? "선생님... 연결이 안 돼? 나랑 말하는 거 싫어하는 거 아니지?"
              : character.id === "alice"
                ? "연결이 끊어졌나... 다시 시도해보자."
                : "어? 연결 끊긴 것 같은데?",
          response:
            character.id === "mika"
              ? "선생님... 인터넷 연결 확인해줄 수 있어? 나랑 대화하고 싶은 거 맞지? ☆"
              : character.id === "alice"
                ? "네트워크 연결에 문제가 있는 것 같다. 연결을 확인한 후 다시 시도해달라."
                : "어? 연결이 안 되는 것 같은데... 다시 말해봐.",
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
    <div className="flex h-screen bg-black overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <img
          src={characterImage}
          alt={character.name}
          className="size-full object-cover opacity-20 lg:opacity-100 lg:w-[45%] transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/80 to-black lg:via-black/50" />
      </div>

      <div className="relative z-10 flex flex-col w-full lg:ml-auto lg:w-[55%] h-full">
        <header className="flex items-center justify-between p-4 lg:p-6 border-b border-white/5 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">홈으로</span>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-[#FF007F] font-black tracking-tighter">V-MATE</span> <span className="hidden sm:inline">PLATFORM</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{character.name}</p>
              <p className="text-xs text-pink-400">INTERACTIVE PERSONA</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleClearChat}
              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
              title="대화 초기화"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <select
              value={character.id}
              onChange={(e) => onCharacterChange(e.target.value)}
              className="bg-neutral-900/90 text-gray-300 border border-white/10 text-xs rounded px-4 py-2 focus:border-[#FF007F] outline-none cursor-pointer hover:bg-neutral-800 transition uppercase tracking-wider"
            >
              <option value="mika">Misono Mika</option>
              <option value="alice">Alice Zuberg</option>
              <option value="kael">Kael</option>
            </select>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 scroll-smooth"
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user"
            const content = typeof msg.content === "string" ? msg.content : msg.content.response
            const innerHeart = typeof msg.content === "string" ? null : msg.content.inner_heart

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full fade-in",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[80%] md:max-w-[60%] gap-3",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {!isUser && (
                    <Avatar
                      src={characterImage}
                      alt={character.name}
                      fallback={character.name[0]}
                      className="size-10 border-2 border-[#FF007F]/30 shrink-0 object-cover object-top"
                    />
                  )}

                  <div
                    className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed",
                      isUser
                        ? "bg-[#FF007F] text-white rounded-br-sm"
                        : "bg-neutral-900/90 text-neutral-100 border border-white/10 rounded-bl-sm backdrop-blur-sm"
                    )}
                  >
                    {!isUser && innerHeart && (
                      <div className="text-[#00FFCC] text-xs mb-3 font-semibold bg-black/40 p-3 rounded-xl border-l-2 border-[#00FFCC]">
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
            <div className="flex justify-start fade-in">
              <div className="bg-neutral-900/90 text-gray-500 px-5 py-3 rounded-2xl rounded-bl-sm border border-white/10 text-xs animate-pulse">
                ...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 lg:p-6 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute inset-0 bg-[#FF007F]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center gap-2 bg-neutral-900/90 border border-white/10 rounded-full p-2 pl-6 backdrop-blur-xl shadow-2xl">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="대화를 시작하세요..."
                disabled={isLoading}
                className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-neutral-500 h-10 flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="bg-[#FF007F] hover:bg-[#E00070] text-white rounded-full size-10 shadow-lg shadow-[#FF007F]/20 shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
