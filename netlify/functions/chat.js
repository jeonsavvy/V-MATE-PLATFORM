/**
 * Netlify Serverless Function: Gemini API 중계 서버
 * - API key 은닉
 * - Origin allowlist 기반 CORS
 * - Origin/IP 기반 rate limit
 * - Gemini 응답 JSON 정규화
 */

const rateLimitStore = new Map();

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
        'X-V-MATE-Function': 'chat-v3',
        'Content-Type': 'application/json',
    };
};

const normalizeAssistantPayload = (rawText) => {
    const safeFallback = {
        emotion: 'normal',
        inner_heart: '',
        response: '잠시 응답 형식이 불안정했어요. 한 번만 다시 말해줘.',
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

    return {
        emotion,
        inner_heart: innerHeart,
        response,
    };
};

export const handler = async (event, context) => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const originAllowed = isOriginAllowed(origin);
    const headers = buildHeaders(originAllowed, origin);

    // OPTIONS 요청 처리 (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        if (!originAllowed) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Origin is not allowed.' }),
            };
        }

        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    if (!originAllowed) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Origin is not allowed.' }),
        };
    }

    const rateKey = getClientKey(event, origin);
    const rateStatus = checkRateLimit(rateKey);
    if (!rateStatus.allowed) {
        return {
            statusCode: 429,
            headers: {
                ...headers,
                'Retry-After': String(Math.ceil(rateStatus.retryAfterMs / 1000)),
            },
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
                headers,
                body: JSON.stringify({
                    error: 'API key not configured. Please set GOOGLE_API_KEY in Netlify environment variables.',
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
                headers,
                body: JSON.stringify({
                    error: 'Invalid request body. Expected JSON format.',
                    details: parseError.message,
                }),
            };
        }

        const { systemPrompt, userMessage, messageHistory } = requestData;

        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'userMessage is required and must be a non-empty string.',
                }),
            };
        }

        const MAX_HISTORY_MESSAGES = Number(process.env.GEMINI_HISTORY_MESSAGES || 8);
        const MAX_PART_CHARS = Number(process.env.GEMINI_MAX_PART_CHARS || 1200);
        const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_MODEL_TIMEOUT_MS || 14000);
        const FUNCTION_TOTAL_TIMEOUT_MS = Number(process.env.FUNCTION_TOTAL_TIMEOUT_MS || 22000);
        const FUNCTION_TIMEOUT_GUARD_MS = Number(process.env.FUNCTION_TIMEOUT_GUARD_MS || 1200);
        const GEMINI_RETRY_BACKOFF_MS = Number(process.env.GEMINI_RETRY_BACKOFF_MS || 250);
        const clampText = (value) => String(value ?? '').slice(0, MAX_PART_CHARS);

        const contents = [];

        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt }],
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'Understood. I will respond in the specified JSON format.' }],
            });
        }

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

        const MODEL_NAME = 'gemini-3-flash-preview';
        const MAX_MODEL_ATTEMPTS = 2; // 첫 호출 + 동일 모델 1회 재시도
        const requestStartedAt = Date.now();
        const getRemainingBudget = () =>
            FUNCTION_TOTAL_TIMEOUT_MS - (Date.now() - requestStartedAt);

        let geminiResponse;
        let geminiData;
        let lastModelError = null;

        for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
            const remainingBudget = getRemainingBudget();
            const attemptTimeoutMs = Math.min(
                MODEL_TIMEOUT_MS,
                Math.max(0, remainingBudget - FUNCTION_TIMEOUT_GUARD_MS)
            );

            if (attemptTimeoutMs <= 0) {
                lastModelError = {
                    status: 504,
                    message: 'Function timeout budget exceeded before model response.',
                };
                break;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);

            try {
                geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents,
                            generationConfig: {
                                responseMimeType: 'application/json',
                                maxOutputTokens: 1024,
                            },
                        }),
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
                    };
                    if (attempt < MAX_MODEL_ATTEMPTS) {
                        continue;
                    }
                    break;
                }

                if (geminiResponse.ok && !geminiData.error) {
                    lastModelError = null;
                    break;
                }

                const modelErrorMessage = geminiData?.error?.message || 'Model call failed';
                const retryableStatuses = [429, 500, 502, 503, 504];
                const normalizedErrorMessage = String(modelErrorMessage).toLowerCase();
                const isRetryableMessage =
                    normalizedErrorMessage.includes('temporarily unavailable') ||
                    normalizedErrorMessage.includes('timeout') ||
                    normalizedErrorMessage.includes('try again') ||
                    normalizedErrorMessage.includes('rate limit') ||
                    normalizedErrorMessage.includes('overloaded');
                const isRetryableStatus = retryableStatuses.includes(geminiResponse.status);

                lastModelError = {
                    status: geminiResponse.status || 500,
                    message: modelErrorMessage,
                };

                if (attempt < MAX_MODEL_ATTEMPTS && (isRetryableStatus || isRetryableMessage)) {
                    const remainingAfterFailure = getRemainingBudget();
                    if (remainingAfterFailure <= FUNCTION_TIMEOUT_GUARD_MS + 700) {
                        break;
                    }
                    const retryDelay = Math.min(
                        GEMINI_RETRY_BACKOFF_MS,
                        Math.max(0, remainingAfterFailure - FUNCTION_TIMEOUT_GUARD_MS - 500)
                    );
                    if (retryDelay > 0) {
                        await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    }
                    continue;
                }

                break;
            } catch (fetchError) {
                clearTimeout(timeoutId);

                if (fetchError?.name === 'AbortError') {
                    lastModelError = {
                        status: 504,
                        message: `Request timeout on model ${MODEL_NAME} (${attemptTimeoutMs}ms).`,
                    };
                } else {
                    lastModelError = {
                        status: 503,
                        message: 'Failed to connect to Gemini API. Please try again later.',
                    };
                }

                if (attempt < MAX_MODEL_ATTEMPTS) {
                    const remainingAfterError = getRemainingBudget();
                    if (remainingAfterError <= FUNCTION_TIMEOUT_GUARD_MS + 700) {
                        break;
                    }
                    const retryDelay = Math.min(
                        GEMINI_RETRY_BACKOFF_MS,
                        Math.max(0, remainingAfterError - FUNCTION_TIMEOUT_GUARD_MS - 500)
                    );
                    if (retryDelay > 0) {
                        await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    }
                    continue;
                }
                break;
            }
        }

        if (!geminiResponse || !geminiData) {
            return {
                statusCode: lastModelError?.status || 503,
                headers,
                body: JSON.stringify({
                    error: lastModelError?.message || 'Model call failed after retry. Please try again later.',
                }),
            };
        }

        if (!geminiResponse.ok || geminiData.error) {
            let errorMessage = 'Failed to get response from Gemini API';

            if (geminiData.error) {
                if (geminiData.error.message?.includes('API_KEY') || geminiData.error.message?.includes('API key')) {
                    errorMessage = 'Invalid or expired API key. Please check your GOOGLE_API_KEY in Netlify environment variables.';
                } else if (geminiData.error.message?.includes('quota') || geminiData.error.message?.includes('Quota')) {
                    errorMessage = 'API quota exceeded. Please check your Google Cloud billing.';
                } else {
                    errorMessage = geminiData.error.message || errorMessage;
                }
            }

            return {
                statusCode: geminiResponse.status || 500,
                headers,
                body: JSON.stringify({ error: errorMessage }),
            };
        }

        if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content?.parts?.[0]?.text) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({ error: 'Invalid response format from Gemini API.' }),
            };
        }

        const normalizedPayload = normalizeAssistantPayload(geminiData.candidates[0].content.parts[0].text);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                text: JSON.stringify(normalizedPayload),
            }),
        };
    } catch (error) {
        console.error('[V-MATE] Unexpected error:', error?.message || error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error. Please try again later.',
                ...(process.env.NETLIFY_DEV && { details: error.message }),
            }),
        };
    }
};
