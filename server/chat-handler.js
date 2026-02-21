/**
 * Cloudflare Worker Chat Handler: Gemini API 중계 서버
 * - API key 은닉
 * - Origin allowlist 기반 CORS
 * - Origin/IP 기반 rate limit
 * - Gemini 응답 JSON 정규화
 */
import { createHash } from 'node:crypto';

const rateLimitStore = new Map();
const promptCacheStore = new Map();
const SUPPORTED_CHARACTER_IDS = new Set(['mika', 'alice', 'kael']);

const shouldUseGeminiContextCache = () =>
    String(process.env.GEMINI_CONTEXT_CACHE_ENABLED || 'true').toLowerCase() !== 'false';

const getGeminiContextCacheConfig = () => ({
    ttlSeconds: Number(process.env.GEMINI_CONTEXT_CACHE_TTL_SECONDS || 21600),
    createTimeoutMs: Number(process.env.GEMINI_CONTEXT_CACHE_CREATE_TIMEOUT_MS || 1800),
    warmupMinChars: Number(process.env.GEMINI_CONTEXT_CACHE_WARMUP_MIN_CHARS || 1200),
    autoCreateEnabled: String(process.env.GEMINI_CONTEXT_CACHE_AUTO_CREATE || 'false').toLowerCase() !== 'false',
});

const toStablePromptHash = (prompt) =>
    createHash('sha256')
        .update(String(prompt || ''))
        .digest('hex')
        .slice(0, 24);

const buildPromptCacheKey = (characterId, promptHash) => `${characterId}:${promptHash}`;

const getValidPromptCache = (cacheKey) => {
    const entry = promptCacheStore.get(cacheKey);
    if (!entry) {
        return null;
    }

    // 만료 15초 전부터는 재사용하지 않고 재생성 유도
    if (!entry.expireAtMs || Date.now() >= entry.expireAtMs - 15000) {
        promptCacheStore.delete(cacheKey);
        return null;
    }

    return entry;
};

const removePromptCache = (cacheKey) => {
    if (!cacheKey) return;
    promptCacheStore.delete(cacheKey);
};

const isValidCachedContentName = (value) => {
    const text = String(value || '').trim();
    if (!text.startsWith('cachedContents/')) {
        return false;
    }
    return /^[A-Za-z0-9/_\-.]+$/.test(text);
};

const parseCachedContentName = (value) => {
    const text = String(value || '').trim();
    return isValidCachedContentName(text) ? text : null;
};

const buildUpstreamFallbackPayload = (characterId) => {
    if (characterId === 'mika') {
        return {
            emotion: 'normal',
            inner_heart: '선생님이 기다렸을 텐데... 잠깐 숨 고르고 다시 집중하자.',
            response: '선생님, 방금 신호가 살짝 흔들렸어. 한 번만 다시 말해줘. 이번엔 제대로 들을게.',
            narration: '',
        };
    }

    if (characterId === 'alice') {
        return {
            emotion: 'normal',
            inner_heart: '연결이 순간 흔들렸군. 침착하게 다시 정비하면 된다.',
            response: '통신이 잠시 불안정했다. 같은 내용을 한 번 더 전해주겠는가.',
            narration: '',
        };
    }

    if (characterId === 'kael') {
        return {
            emotion: 'normal',
            inner_heart: '아... 튕겼네. 기다리게 해서 미안한데 다시 받으면 된다.',
            response: '지금 신호 잠깐 튐. 한 번만 다시 보내줘.',
            narration: '',
        };
    }

    return {
        emotion: 'normal',
        inner_heart: '응답 연결이 잠시 불안정했다.',
        response: '연결이 잠시 흔들렸어요. 같은 내용을 한 번만 다시 보내주세요.',
        narration: '',
    };
};

const createPromptCacheEntry = async ({
    apiKey,
    modelName,
    characterId,
    systemPrompt,
    cacheKey,
}) => {
    const { ttlSeconds, createTimeoutMs } = getGeminiContextCacheConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), createTimeoutMs);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: `models/${modelName}`,
                    displayName: `vmate-${characterId}-${cacheKey.slice(-8)}`,
                    ttl: `${Math.max(300, ttlSeconds)}s`,
                    systemInstruction: {
                        role: 'system',
                        parts: [{ text: String(systemPrompt) }],
                    },
                }),
                signal: controller.signal,
            }
        );

        let data;
        try {
            data = await response.json();
        } catch {
            return null;
        }

        if (!response.ok || data?.error || !data?.name) {
            return null;
        }

        const expireAtMs = data?.expireTime ? Date.parse(data.expireTime) : NaN;
        const safeExpireAtMs = Number.isFinite(expireAtMs)
            ? expireAtMs
            : Date.now() + Math.max(300, ttlSeconds) * 1000;

        const entry = {
            name: data.name,
            expireAtMs: safeExpireAtMs,
        };

        promptCacheStore.set(cacheKey, entry);
        return entry;
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

const parseAllowedOrigins = () => {
    const raw = (process.env.ALLOWED_ORIGINS || '').trim();
    if (!raw) {
        return new Set([
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:8888',
            'http://127.0.0.1:8888',
        ]);
    }

    return new Set(
        raw
            .split(',')
            .map((origin) => origin.trim().replace(/\/+$/, ''))
            .filter(Boolean)
    );
};

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

const shouldAllowAllOrigins = () => {
    return String(process.env.ALLOW_ALL_ORIGINS || 'false').toLowerCase() === 'true';
};

const isOriginAllowed = (origin) => {
    if (shouldAllowAllOrigins()) {
        return true;
    }

    if (!origin) {
        // 서버 간 호출/health check 같은 non-browser 호출 허용
        return true;
    }

    const normalized = normalizeOrigin(origin);
    const allowlist = parseAllowedOrigins();
    return allowlist.has(normalized);
};

const getClientKey = (event, origin) => {
    const forwardedFor = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
    const ip = String(forwardedFor || '').split(',')[0].trim();
    if (ip) return `ip:${ip}`;

    if (origin) return `origin:${normalizeOrigin(origin)}`;
    return 'anonymous';
};

const getRateLimitConfig = () => {
    return {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
        maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30),
    };
};

const checkRateLimit = (key) => {
    const { windowMs, maxRequests } = getRateLimitConfig();
    const now = Date.now();

    const existing = rateLimitStore.get(key);
    if (!existing || now > existing.resetAt) {
        const next = {
            count: 1,
            resetAt: now + windowMs,
        };
        rateLimitStore.set(key, next);
        return { allowed: true, remaining: maxRequests - 1, retryAfterMs: windowMs };
    }

    if (existing.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(0, existing.resetAt - now),
        };
    }

    existing.count += 1;
    rateLimitStore.set(key, existing);
    return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        retryAfterMs: Math.max(0, existing.resetAt - now),
    };
};

const buildHeaders = (originAllowed, origin) => {
    const resolvedOrigin = originAllowed ? (origin || '*') : 'null';

    return {
        'Access-Control-Allow-Origin': resolvedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
        'X-V-MATE-Function': 'chat-v4',
        'Content-Type': 'application/json',
    };
};

const withElapsedHeader = (headers, startedAtMs) => ({
    ...headers,
    'X-V-MATE-Elapsed-Ms': String(Math.max(0, Date.now() - startedAtMs)),
});

const normalizeAssistantPayload = (rawText) => {
    const safeFallback = {
        emotion: 'normal',
        inner_heart: '',
        response: '잠시 응답 형식이 불안정했어요. 한 번만 다시 말해줘.',
        narration: '',
    };

    if (!rawText || typeof rawText !== 'string') {
        return safeFallback;
    }

    const jsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        return safeFallback;
    }

    const emotion = typeof parsed?.emotion === 'string' && parsed.emotion.trim()
        ? parsed.emotion.trim()
        : 'normal';

    const innerHeart = typeof parsed?.inner_heart === 'string'
        ? parsed.inner_heart.trim()
        : '';

    const response = typeof parsed?.response === 'string' && parsed.response.trim()
        ? parsed.response.trim()
        : safeFallback.response;

    const narration = typeof parsed?.narration === 'string'
        ? parsed.narration.trim()
        : '';

    return {
        emotion,
        inner_heart: innerHeart,
        response,
        narration,
    };
};

export const handler = async (event, context) => {
    const requestStartedAt = Date.now();
    const origin = event.headers?.origin || event.headers?.Origin;
    const originAllowed = isOriginAllowed(origin);
    const headers = buildHeaders(originAllowed, origin);

    // OPTIONS 요청 처리 (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        if (!originAllowed) {
            return {
                statusCode: 403,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({ error: 'Origin is not allowed.' }),
            };
        }

        return {
            statusCode: 200,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: '',
        };
    }

    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    if (!originAllowed) {
        return {
            statusCode: 403,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify({ error: 'Origin is not allowed.' }),
        };
    }

    const rateKey = getClientKey(event, origin);
    const rateStatus = checkRateLimit(rateKey);
    if (!rateStatus.allowed) {
        return {
            statusCode: 429,
            headers: withElapsedHeader({
                ...headers,
                'Retry-After': String(Math.ceil(rateStatus.retryAfterMs / 1000)),
            }, requestStartedAt),
            body: JSON.stringify({
                error: 'Too many requests. Please try again later.',
            }),
        };
    }

    try {
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: 'API key not configured. Please set GOOGLE_API_KEY in runtime secrets.',
                }),
            };
        }

        // 요청 본문 파싱 및 검증
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: 'Invalid request body. Expected JSON format.',
                    details: parseError.message,
                }),
            };
        }

        const { systemPrompt, userMessage, messageHistory, characterId, cachedContent } = requestData;

        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: 'userMessage is required and must be a non-empty string.',
                }),
            };
        }

        const MAX_HISTORY_MESSAGES = Number(process.env.GEMINI_HISTORY_MESSAGES || 8);
        const MAX_PART_CHARS = Number(process.env.GEMINI_MAX_PART_CHARS || 700);
        const MAX_SYSTEM_PROMPT_CHARS = Number(process.env.GEMINI_MAX_SYSTEM_PROMPT_CHARS || 1800);
        const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_MODEL_TIMEOUT_MS || 10000);
        const FUNCTION_TOTAL_TIMEOUT_MS = Number(process.env.FUNCTION_TOTAL_TIMEOUT_MS || 13000);
        const FUNCTION_TIMEOUT_GUARD_MS = Number(process.env.FUNCTION_TIMEOUT_GUARD_MS || 1200);
        const clampText = (value) => String(value ?? '').slice(0, MAX_PART_CHARS);
        const clampSystemPrompt = (value) => String(value ?? '').slice(0, MAX_SYSTEM_PROMPT_CHARS);

        const normalizedCharacterId = String(characterId || '').trim().toLowerCase();
        const requestCachedContent = parseCachedContentName(cachedContent);
        const trimmedSystemPrompt = String(systemPrompt || '').trim();
        const MODEL_NAME = String(process.env.GEMINI_MODEL_NAME || 'gemini-3-flash-preview').trim() || 'gemini-3-flash-preview';

        const canUseContextCache =
            shouldUseGeminiContextCache() &&
            Boolean(trimmedSystemPrompt) &&
            SUPPORTED_CHARACTER_IDS.has(normalizedCharacterId);

        let promptCacheKey = null;
        let cachedContentName = null;

        if (canUseContextCache) {
            const promptHash = toStablePromptHash(trimmedSystemPrompt);
            promptCacheKey = buildPromptCacheKey(normalizedCharacterId, promptHash);
            cachedContentName =
                requestCachedContent ||
                getValidPromptCache(promptCacheKey)?.name ||
                null;
        }

        const contents = [];

        if (messageHistory && Array.isArray(messageHistory)) {
            const recentHistory = messageHistory.slice(-MAX_HISTORY_MESSAGES);
            recentHistory.forEach((msg) => {
                if (msg.role === 'user') {
                    contents.push({ role: 'user', parts: [{ text: clampText(msg.content) }] });
                } else if (msg.role === 'assistant') {
                    const assistantText = typeof msg.content === 'object' ? msg.content.response : msg.content;
                    contents.push({ role: 'model', parts: [{ text: clampText(assistantText) }] });
                }
            });
        }

        contents.push({
            role: 'user',
            parts: [{ text: clampText(userMessage) }],
        });

        const contentsWithSystemPrompt = [];
        if (trimmedSystemPrompt) {
            contentsWithSystemPrompt.push({
                role: 'user',
                parts: [{ text: clampSystemPrompt(trimmedSystemPrompt) }],
            });
            contentsWithSystemPrompt.push({
                role: 'model',
                parts: [{ text: 'Understood. I will respond in the specified JSON format.' }],
            });
        }
        contentsWithSystemPrompt.push(...contents);
        const getRemainingBudget = () =>
            FUNCTION_TOTAL_TIMEOUT_MS - (Date.now() - requestStartedAt);

        if (canUseContextCache && !cachedContentName) {
            const { warmupMinChars, autoCreateEnabled } = getGeminiContextCacheConfig();
            const hasEnoughBudgetForCacheCreate = getRemainingBudget() > FUNCTION_TIMEOUT_GUARD_MS + 3000;
            const isFirstTurn = !Array.isArray(messageHistory) || messageHistory.length === 0;
            const shouldCreateInline =
                autoCreateEnabled &&
                hasEnoughBudgetForCacheCreate &&
                isFirstTurn &&
                trimmedSystemPrompt.length >= warmupMinChars;

            if (shouldCreateInline) {
                const createdCache = await createPromptCacheEntry({
                    apiKey,
                    modelName: MODEL_NAME,
                    characterId: normalizedCharacterId,
                    systemPrompt: clampSystemPrompt(trimmedSystemPrompt),
                    cacheKey: promptCacheKey,
                });

                if (createdCache?.name) {
                    cachedContentName = createdCache.name;
                }
            }
        }

        let geminiResponse;
        let geminiData;
        let lastModelError = null;

        const remainingBudget = getRemainingBudget();
        const attemptTimeoutMs = Math.min(
            MODEL_TIMEOUT_MS,
            Math.max(0, remainingBudget - FUNCTION_TIMEOUT_GUARD_MS)
        );

        if (attemptTimeoutMs <= 0) {
            lastModelError = {
                status: 504,
                message: 'Function timeout budget exceeded before model response.',
                code: 'FUNCTION_BUDGET_TIMEOUT',
            };
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);

            try {
                const requestPayload = {
                    contents: cachedContentName ? contents : contentsWithSystemPrompt,
                    generationConfig: {
                        responseMimeType: 'application/json',
                        maxOutputTokens: 320,
                    },
                };

                if (cachedContentName) {
                    requestPayload.cachedContent = cachedContentName;
                }

                geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestPayload),
                        signal: controller.signal,
                    }
                );

                clearTimeout(timeoutId);

                try {
                    geminiData = await geminiResponse.json();
                } catch {
                    lastModelError = {
                        status: 502,
                        message: 'Invalid response from Gemini API.',
                        code: 'UPSTREAM_INVALID_RESPONSE',
                    };
                }

                if (geminiResponse?.ok && geminiData && !geminiData.error) {
                    lastModelError = null;
                } else if (!lastModelError) {
                    const modelErrorMessage = geminiData?.error?.message || 'Model call failed';
                    const normalizedErrorMessage = String(modelErrorMessage).toLowerCase();
                    const isCacheLookupError =
                        cachedContentName &&
                        (normalizedErrorMessage.includes('cachedcontent') ||
                            normalizedErrorMessage.includes('cached content') ||
                            normalizedErrorMessage.includes('not found') ||
                            normalizedErrorMessage.includes('expired'));

                    lastModelError = {
                        status: geminiResponse?.status || 500,
                        message: modelErrorMessage,
                        code: 'UPSTREAM_MODEL_ERROR',
                    };

                    if (isCacheLookupError) {
                        removePromptCache(promptCacheKey);
                        cachedContentName = null;
                    }
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);

                if (fetchError?.name === 'AbortError') {
                    lastModelError = {
                        status: 504,
                        message: `Request timeout on model ${MODEL_NAME} (${attemptTimeoutMs}ms).`,
                        code: 'UPSTREAM_TIMEOUT',
                    };
                } else {
                    lastModelError = {
                        status: 503,
                        message: 'Failed to connect to Gemini API. Please try again later.',
                        code: 'UPSTREAM_CONNECTION_FAILED',
                    };
                }
            }
        }

        if (!geminiResponse || !geminiData) {
            const upstreamErrorCode = lastModelError?.code || 'UPSTREAM_UNKNOWN_ERROR';
            const shouldUseFallbackPayload =
                upstreamErrorCode === 'UPSTREAM_CONNECTION_FAILED' ||
                upstreamErrorCode === 'UPSTREAM_TIMEOUT' ||
                upstreamErrorCode === 'FUNCTION_BUDGET_TIMEOUT';

            if (shouldUseFallbackPayload) {
                const fallbackPayload = buildUpstreamFallbackPayload(normalizedCharacterId);
                return {
                    statusCode: 200,
                    headers: withElapsedHeader(headers, requestStartedAt),
                    body: JSON.stringify({
                        text: JSON.stringify(fallbackPayload),
                        cachedContent: cachedContentName || null,
                        error_code: upstreamErrorCode,
                    }),
                };
            }

            return {
                statusCode: lastModelError?.status || 503,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: lastModelError?.message || 'Model call failed. Please try again later.',
                    error_code: upstreamErrorCode,
                }),
            };
        }

        if (!geminiResponse.ok || geminiData.error) {
            let errorMessage = 'Failed to get response from Gemini API';
            let errorCode = 'UPSTREAM_MODEL_ERROR';

            if (geminiData.error) {
                if (geminiData.error.message?.includes('API_KEY') || geminiData.error.message?.includes('API key')) {
                    errorMessage = 'Invalid or expired API key. Please check your GOOGLE_API_KEY in Cloudflare Worker secrets.';
                } else if (geminiData.error.message?.includes('quota') || geminiData.error.message?.includes('Quota')) {
                    errorMessage = 'API quota exceeded. Please check your Google Cloud billing.';
                } else if (
                    geminiData.error.message?.includes('location is not supported') ||
                    geminiData.error.message?.includes('User location is not supported')
                ) {
                    errorMessage = 'Gemini API is not available in this server region. Deploy backend in a supported region or switch provider.';
                    errorCode = 'UPSTREAM_LOCATION_UNSUPPORTED';
                } else {
                    errorMessage = geminiData.error.message || errorMessage;
                }
            }

            return {
                statusCode: geminiResponse.status || 500,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: errorMessage,
                    error_code: errorCode,
                }),
            };
        }

        if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content?.parts?.[0]?.text) {
            return {
                statusCode: 502,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({ error: 'Invalid response format from Gemini API.' }),
            };
        }

        const normalizedPayload = normalizeAssistantPayload(geminiData.candidates[0].content.parts[0].text);
        const responseCachedContent = cachedContentName || null;

        if (canUseContextCache && promptCacheKey && responseCachedContent) {
            const { ttlSeconds } = getGeminiContextCacheConfig();
            promptCacheStore.set(promptCacheKey, {
                name: responseCachedContent,
                expireAtMs: Date.now() + Math.max(300, ttlSeconds) * 1000,
            });
        }

        return {
            statusCode: 200,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify({
                text: JSON.stringify(normalizedPayload),
                cachedContent: responseCachedContent,
            }),
        };
    } catch (error) {
        console.error('[V-MATE] Unexpected error:', error?.message || error);

        return {
            statusCode: 500,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify({
                error: 'Internal server error. Please try again later.',
                ...(process.env.CLOUDFLARE_DEV && { details: error.message }),
            }),
        };
    }
};
