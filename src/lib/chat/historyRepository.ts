import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { AIResponse, Character, Message } from "@/lib/data"
import { CHARACTERS } from "@/lib/data"
import { devWarn } from "@/lib/logger"

const LOCAL_HISTORY_KEY_PREFIX = "chat_history_"
const PROMPT_CACHE_KEY_PREFIX = "gemini_cached_content_"
const ALLOWED_EMOTIONS = new Set<AIResponse["emotion"]>(["normal", "happy", "confused", "angry"])

export interface HistoryPreview {
  text: string
  updatedAt: string | null
  hasHistory: boolean
}

export interface RecentChatItem {
  characterId: string
  preview: string
  updatedAt: string | null
}

interface ChatMessageRow {
  id: string | number
  role: "user" | "assistant"
  content: unknown
  created_at: string | null
  character_id: string
}

const getLocalHistoryKey = (characterId: string) => `${LOCAL_HISTORY_KEY_PREFIX}${characterId}`

export const getPromptCacheKey = (characterId: string) => `${PROMPT_CACHE_KEY_PREFIX}${characterId}`

const toGreetingMessage = (character: Character): Message => ({
  id: "greeting",
  role: "assistant",
  content: {
    emotion: "normal",
    inner_heart: "",
    response: character.greeting,
  },
})

const sanitizeAssistantPayload = (value: unknown): AIResponse | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const payload = value as Record<string, unknown>
  const response = typeof payload.response === "string" ? payload.response.trim() : ""
  if (!response) {
    return null
  }

  const rawEmotion = typeof payload.emotion === "string" ? payload.emotion.toLowerCase().trim() : "normal"
  const emotion = ALLOWED_EMOTIONS.has(rawEmotion as AIResponse["emotion"])
    ? (rawEmotion as AIResponse["emotion"])
    : "normal"
  const innerHeart = typeof payload.inner_heart === "string" ? payload.inner_heart.trim() : ""
  const narration = typeof payload.narration === "string" ? payload.narration.trim() : ""

  return {
    emotion,
    inner_heart: innerHeart,
    response,
    ...(narration ? { narration } : {}),
  }
}

const parseStoredJsonContent = (content: unknown): unknown => {
  if (typeof content !== "string") {
    return content
  }

  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

const toMessageContent = (content: unknown, role: "user" | "assistant"): Message["content"] => {
  const parsedContent = parseStoredJsonContent(content)

  if (role === "user") {
    if (typeof parsedContent === "string") {
      return parsedContent
    }

    if (parsedContent && typeof parsedContent === "object") {
      const objectValue = parsedContent as Record<string, unknown>
      if (typeof objectValue.text === "string" && objectValue.text.trim()) {
        return objectValue.text
      }
      if (typeof objectValue.response === "string" && objectValue.response.trim()) {
        return objectValue.response
      }
    }

    return ""
  }

  const assistantPayload = sanitizeAssistantPayload(parsedContent)
  if (assistantPayload) {
    return assistantPayload
  }

  if (typeof parsedContent === "string" && parsedContent.trim()) {
    return {
      emotion: "normal",
      inner_heart: "",
      response: parsedContent,
    }
  }

  return {
    emotion: "normal",
    inner_heart: "",
    response: "대화를 다시 이어가보자.",
  }
}

const withGreeting = (messages: Message[], character: Character): Message[] => {
  const greeting = toGreetingMessage(character)
  if (messages.length === 0) {
    return [greeting]
  }

  if (messages[0].id === "greeting") {
    const next = [...messages]
    next[0] = greeting
    return next
  }

  return [greeting, ...messages]
}

const toPersistableMessages = (messages: Message[]): Message[] =>
  messages.filter((message) => message.id !== "greeting")

export const toPreviewText = (content: Message["content"]): string => {
  if (typeof content === "string") {
    return content
  }
  return typeof content.response === "string" ? content.response : ""
}

export const parseSavedContentToPreview = (content: unknown): string => {
  const parsed = parseStoredJsonContent(content)
  if (typeof parsed === "string") {
    return parsed
  }
  if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).response === "string") {
    return String((parsed as Record<string, unknown>).response)
  }
  if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).text === "string") {
    return String((parsed as Record<string, unknown>).text)
  }
  return ""
}

export const toTruncatedPreview = (text: string, max = 48): string => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim()
  if (normalized.length <= max) {
    return normalized
  }
  return `${normalized.slice(0, max)}…`
}

const readGuestHistory = (character: Character): Message[] => {
  const localKey = getLocalHistoryKey(character.id)
  const saved = localStorage.getItem(localKey)
  if (!saved) {
    return [toGreetingMessage(character)]
  }

  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      return [toGreetingMessage(character)]
    }

    const normalized = parsed
      .map((message): Message | null => {
        if (!message || typeof message !== "object") {
          return null
        }
        const msg = message as Partial<Message>
        if (msg.role !== "user" && msg.role !== "assistant") {
          return null
        }

        return {
          id: String(msg.id || Date.now()),
          role: msg.role,
          content: toMessageContent(msg.content, msg.role),
          timestamp: typeof msg.timestamp === "string" ? msg.timestamp : undefined,
        }
      })
      .filter((message): message is Message => Boolean(message))

    return withGreeting(normalized, character)
  } catch (error) {
    devWarn(`[V-MATE] Failed to parse guest history for ${character.id}`, error)
    return [toGreetingMessage(character)]
  }
}

const writeGuestHistory = (characterId: string, messages: Message[]) => {
  const localKey = getLocalHistoryKey(characterId)
  try {
    localStorage.setItem(localKey, JSON.stringify(toPersistableMessages(messages)))
  } catch (error) {
    devWarn(`[V-MATE] Failed to save guest history for ${characterId}`, error)
  }
}

export const saveGuestHistory = (characterId: string, messages: Message[]) => {
  writeGuestHistory(characterId, messages)
}

export const clearGuestHistory = (characterId: string) => {
  localStorage.removeItem(getLocalHistoryKey(characterId))
}

const resolveSupabaseClient = async () => {
  const module = await import("@/lib/supabase")
  if (!module.isSupabaseConfigured()) {
    return null
  }
  return module.supabase
}

export const loadChatHistory = async ({
  user,
  character,
}: {
  user: SupabaseUser | null
  character: Character
}): Promise<Message[]> => {
  if (!user) {
    return readGuestHistory(character)
  }

  const supabase = await resolveSupabaseClient()
  if (!supabase) {
    return [toGreetingMessage(character)]
  }

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at, character_id")
      .eq("user_id", user.id)
      .eq("character_id", character.id)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    const messages = (data as ChatMessageRow[] | null)?.map((row) => ({
      id: String(row.id),
      role: row.role,
      content: toMessageContent(row.content, row.role),
      timestamp: row.created_at || undefined,
    })) ?? []

    return withGreeting(messages, character)
  } catch (error) {
    devWarn(`[V-MATE] Failed to load Supabase history for ${character.id}`, error)
    return [toGreetingMessage(character)]
  }
}

export const saveChatMessage = async ({
  user,
  message,
  characterId,
}: {
  user: SupabaseUser | null
  message: Message
  characterId: string
}) => {
  if (!user) {
    return
  }

  const supabase = await resolveSupabaseClient()
  if (!supabase) {
    return
  }

  const payload = typeof message.content === "string"
    ? { text: message.content }
    : message.content

  try {
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      character_id: characterId,
      role: message.role,
      content: payload,
    })

    if (error) {
      throw error
    }
  } catch (error) {
    devWarn(`[V-MATE] Failed to save message for ${characterId}`, error)
  }
}

export const clearChatHistory = async ({
  user,
  characterId,
}: {
  user: SupabaseUser | null
  characterId: string
}) => {
  if (!user) {
    clearGuestHistory(characterId)
    return
  }

  const supabase = await resolveSupabaseClient()
  if (!supabase) {
    return
  }

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", user.id)
    .eq("character_id", characterId)

  if (error) {
    throw error
  }
}

export const loadHistoryPreviews = async ({
  user,
}: {
  user: SupabaseUser | null
}): Promise<Record<string, HistoryPreview>> => {
  const previews: Record<string, HistoryPreview> = {}

  if (!user) {
    Object.values(CHARACTERS).forEach((character) => {
      const localKey = getLocalHistoryKey(character.id)
      const saved = localStorage.getItem(localKey)
      if (!saved) {
        return
      }

      try {
        const parsed = JSON.parse(saved) as Message[]
        const last = parsed[parsed.length - 1]
        if (!last) {
          return
        }

        previews[character.id] = {
          text: toTruncatedPreview(toPreviewText(toMessageContent(last.content, last.role))),
          updatedAt: last.timestamp || null,
          hasHistory: true,
        }
      } catch (error) {
        devWarn(`[V-MATE] Failed to parse guest preview for ${character.id}`, error)
      }
    })

    return previews
  }

  const supabase = await resolveSupabaseClient()
  if (!supabase) {
    return previews
  }

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("character_id, content, created_at, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    for (const row of (data as Pick<ChatMessageRow, "character_id" | "content" | "created_at" | "role">[] | null) || []) {
      const characterId = String(row.character_id || "")
      if (!CHARACTERS[characterId]) {
        continue
      }

      const previewText = toTruncatedPreview(parseSavedContentToPreview(row.content))
      if (!previewText) {
        continue
      }

      previews[characterId] = {
        text: previewText,
        updatedAt: row.created_at || null,
        hasHistory: true,
      }
    }

    return previews
  } catch (error) {
    devWarn("[V-MATE] Failed to load Supabase history previews", error)
    return previews
  }
}

export const loadRecentChats = async ({
  user,
}: {
  user: SupabaseUser | null
}): Promise<RecentChatItem[]> => {
  if (!user) {
    const recentItems: RecentChatItem[] = []
    Object.values(CHARACTERS).forEach((character) => {
      const localKey = getLocalHistoryKey(character.id)
      const saved = localStorage.getItem(localKey)
      if (!saved) {
        return
      }

      try {
        const parsed = JSON.parse(saved) as Message[]
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return
        }
        const last = parsed[parsed.length - 1]
        const preview = toTruncatedPreview(toPreviewText(toMessageContent(last.content, last.role)), 42)
        if (!preview) {
          return
        }

        recentItems.push({
          characterId: character.id,
          preview,
          updatedAt: typeof last.timestamp === "string" ? last.timestamp : null,
        })
      } catch (error) {
        devWarn(`[V-MATE] Failed to parse guest recent chats for ${character.id}`, error)
      }
    })

    recentItems.sort((a, b) => {
      const dateA = a.updatedAt ? Date.parse(a.updatedAt) : 0
      const dateB = b.updatedAt ? Date.parse(b.updatedAt) : 0
      return dateB - dateA
    })
    return recentItems
  }

  const supabase = await resolveSupabaseClient()
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("character_id, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    const map = new Map<string, RecentChatItem>()
    for (const row of (data as Pick<ChatMessageRow, "character_id" | "content" | "created_at">[] | null) || []) {
      const characterId = String(row.character_id || "")
      if (!CHARACTERS[characterId] || map.has(characterId)) {
        continue
      }

      const preview = toTruncatedPreview(parseSavedContentToPreview(row.content), 42)
      if (!preview) {
        continue
      }

      map.set(characterId, {
        characterId,
        preview,
        updatedAt: row.created_at || null,
      })
    }

    return Array.from(map.values())
  } catch (error) {
    devWarn("[V-MATE] Failed to load recent chats from Supabase", error)
    return []
  }
}

