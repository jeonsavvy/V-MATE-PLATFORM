import type { AIResponse } from "@/lib/data"

export type ChatRequestHistoryItem = {
  role: "user" | "assistant"
  content: string
}

export type ChatRequestV2 = {
  characterId: "mika" | "alice" | "kael"
  userMessage: string
  messageHistory: ChatRequestHistoryItem[]
  cachedContent?: string
  clientRequestId?: string
}

export type ChatResponseV2 = {
  message: AIResponse
  cachedContent: string | null
  trace_id: string
}

export type ChatApiError = Error & {
  chatErrorCode?: string
  chatTraceId?: string
}

const ALLOWED_EMOTIONS = new Set<AIResponse["emotion"]>(["normal", "happy", "confused", "angry"])

export const NETWORK_ERROR_CODES = new Set([
  "CLIENT_NETWORK_ERROR",
  "CLIENT_TIMEOUT",
  "UPSTREAM_CONNECTION_FAILED",
  "UPSTREAM_TIMEOUT",
  "FUNCTION_BUDGET_TIMEOUT",
  "UPSTREAM_EMPTY_RESPONSE",
  "UPSTREAM_EMPTY_RESPONSE_MAX_TOKENS",
])

export const CONFIGURATION_ERROR_CODES = new Set([
  "UPSTREAM_LOCATION_UNSUPPORTED",
  "UPSTREAM_INVALID_FORMAT",
  "UPSTREAM_INVALID_RESPONSE",
  "UPSTREAM_MODEL_ERROR",
])

const resolveRuntimeEnv = () =>
  ((globalThis as { __V_MATE_RUNTIME_ENV__?: Record<string, string | undefined> }).__V_MATE_RUNTIME_ENV__ ?? {})

const resolveChatApiUrl = (): string => {
  const runtimeEnv = resolveRuntimeEnv()
  const baseUrl = String(runtimeEnv.VITE_CHAT_API_BASE_URL || import.meta.env.VITE_CHAT_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "")

  if (!baseUrl) {
    return "/api/chat"
  }

  return baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
}

const sanitizeAssistantMessage = (value: unknown): AIResponse | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const payload = value as Record<string, unknown>
  const rawEmotion = typeof payload.emotion === "string" ? payload.emotion.toLowerCase().trim() : "normal"
  const emotion = ALLOWED_EMOTIONS.has(rawEmotion as AIResponse["emotion"])
    ? (rawEmotion as AIResponse["emotion"])
    : "normal"
  const response = typeof payload.response === "string" ? payload.response.trim() : ""
  if (!response) {
    return null
  }

  const innerHeart = typeof payload.inner_heart === "string" ? payload.inner_heart.trim() : ""
  const narration = typeof payload.narration === "string" ? payload.narration.trim() : ""

  return {
    emotion,
    inner_heart: innerHeart,
    response,
    ...(narration ? { narration } : {}),
  }
}

const parseMessageFromResponse = (data: unknown): AIResponse | null => {
  if (!data || typeof data !== "object") {
    return null
  }

  const payload = data as Record<string, unknown>
  const directMessage = sanitizeAssistantMessage(payload.message)
  if (directMessage) {
    return directMessage
  }

  if (typeof payload.text === "string") {
    try {
      const parsed = JSON.parse(payload.text)
      return sanitizeAssistantMessage(parsed)
    } catch {
      return null
    }
  }

  return null
}

export const createChatApiError = (message: string, errorCode?: string, traceId?: string): ChatApiError => {
  const error = new Error(message) as ChatApiError
  if (errorCode) {
    error.chatErrorCode = errorCode
  }
  if (traceId) {
    error.chatTraceId = traceId
  }
  return error
}

export const mapChatApiErrorMessage = (errorCode: string, fallbackMessage: string) => {
  switch (errorCode) {
    case "UPSTREAM_CONNECTION_FAILED":
    case "UPSTREAM_TIMEOUT":
    case "FUNCTION_BUDGET_TIMEOUT":
    case "UPSTREAM_EMPTY_RESPONSE":
    case "UPSTREAM_EMPTY_RESPONSE_MAX_TOKENS":
      return "AI 서버 연결이 불안정합니다. 잠시 후 다시 시도해주세요."
    case "UPSTREAM_LOCATION_UNSUPPORTED":
      return "현재 서버 지역에서는 Gemini API를 사용할 수 없습니다. 관리자에게 문의해주세요."
    case "UPSTREAM_INVALID_RESPONSE":
    case "UPSTREAM_INVALID_FORMAT":
      return "AI 응답 형식이 불안정합니다. 잠시 후 다시 시도해주세요."
    default:
      return fallbackMessage
  }
}

interface SendChatMessageParams {
  payload: ChatRequestV2
  signal: AbortSignal
  apiVersion?: "1" | "2"
}

export const sendChatMessage = async ({
  payload,
  signal,
  apiVersion = "2",
}: SendChatMessageParams): Promise<ChatResponseV2> => {
  const chatApiUrl = resolveChatApiUrl()
  let response: Response

  try {
    response = await fetch(chatApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-V-MATE-API-Version": apiVersion,
      },
      body: JSON.stringify({
        ...payload,
        api_version: apiVersion,
      }),
      signal,
    })
  } catch (fetchError) {
    if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
      throw createChatApiError("응답 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.", "CLIENT_TIMEOUT")
    }

    const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
    if (message.includes("Failed to fetch")) {
      throw createChatApiError("서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.", "CLIENT_NETWORK_ERROR")
    }

    throw createChatApiError(message || "AI 서버 호출 중 오류가 발생했습니다.", "CLIENT_NETWORK_ERROR")
  }

  let data: Record<string, unknown> = {}
  try {
    const parsed = await response.json()
    if (parsed && typeof parsed === "object") {
      data = parsed as Record<string, unknown>
    }
  } catch {
    data = {}
  }

  const traceId = typeof data.trace_id === "string"
    ? data.trace_id.trim()
    : String(response.headers.get("x-v-mate-trace-id") || "").trim()

  if (!response.ok) {
    const errorCode = typeof data.error_code === "string" ? data.error_code : `HTTP_${response.status}`
    const errorText = typeof data.error === "string" ? data.error : "서버 오류가 발생했습니다."
    throw createChatApiError(mapChatApiErrorMessage(errorCode, errorText), errorCode, traceId)
  }

  const explicitErrorCode = typeof data.error_code === "string" ? data.error_code.trim() : ""
  if (typeof data.error === "string" && data.error.trim()) {
    throw createChatApiError(
      mapChatApiErrorMessage(explicitErrorCode, data.error),
      explicitErrorCode || "UPSTREAM_RESPONSE_ERROR",
      traceId,
    )
  }
  if (explicitErrorCode) {
    throw createChatApiError(
      mapChatApiErrorMessage(explicitErrorCode, "AI 서버 처리 중 오류가 발생했습니다."),
      explicitErrorCode,
      traceId,
    )
  }

  const message = parseMessageFromResponse(data)
  if (!message) {
    throw createChatApiError(
      "AI 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해주세요.",
      "UPSTREAM_INVALID_FORMAT",
      traceId,
    )
  }

  const cachedContent = typeof data.cachedContent === "string"
    ? data.cachedContent.trim()
    : data.cachedContent === null
      ? null
      : null

  return {
    message,
    cachedContent: cachedContent && cachedContent.length > 0 ? cachedContent : null,
    trace_id: traceId,
  }
}

