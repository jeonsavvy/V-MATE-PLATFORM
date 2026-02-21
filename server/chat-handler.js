/**
 * Cloudflare Worker Chat Handler: OpenAI API 중계 서버
 * - API key 은닉
 * - Origin allowlist 기반 CORS
 * - Origin/IP 기반 rate limit
 * - OpenAI 응답 JSON 정규화
 */

const rateLimitStore = new Map();
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
        'X-V-MATE-Function': 'chat-v5-openai',
        'Content-Type': 'application/json',
    };
};

const withElapsedHeader = (headers, startedAtMs) => ({
    ...headers,
    'X-V-MATE-Elapsed-Ms': String(Math.max(0, Date.now() - startedAtMs)),
});

const ALLOWED_EMOTIONS = new Set(['normal', 'happy', 'confused', 'angry']);
const OPENAI_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        emotion: {
            type: 'string',
            enum: ['normal', 'happy', 'confused', 'angry'],
        },
        inner_heart: {
            type: 'string',
        },
        response: {
            type: 'string',
        },
        narration: {
            type: 'string',
        },
    },
    required: ['emotion', 'inner_heart', 'response'],
};

const tryParseJsonObject = (text) => {
    if (!text || typeof text !== 'string') {
        return null;
    }

    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const tryParseLooseJsonObject = (text) => {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const normalizedQuotes = text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();

    const candidates = [normalizedQuotes];

    const quotedKeys = normalizedQuotes.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
    candidates.push(quotedKeys);

    const singleToDouble = quotedKeys.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
        const escaped = String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `"${escaped}"`;
    });
    candidates.push(singleToDouble);

    const noTrailingComma = singleToDouble.replace(/,\s*([}\]])/g, '$1');
    candidates.push(noTrailingComma);

    for (const candidate of candidates) {
        const parsed = tryParseJsonObject(candidate);
        if (parsed) {
            return parsed;
        }
    }

    return null;
};

const extractJsonObjectCandidates = (text) => {
    const candidates = [];
    if (!text || typeof text !== 'string') {
        return candidates;
    }

    let depth = 0;
    let start = -1;
    let inString = false;
    let escaping = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];

        if (escaping) {
            escaping = false;
            continue;
        }

        if (ch === '\\') {
            escaping = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (ch === '{') {
            if (depth === 0) {
                start = i;
            }
            depth += 1;
            continue;
        }

        if (ch === '}') {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                candidates.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return candidates;
};

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

    const normalizedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed = tryParseJsonObject(normalizedText);
    if (!parsed) {
        const candidates = extractJsonObjectCandidates(normalizedText);
        for (const candidate of candidates) {
            const maybeParsed = tryParseJsonObject(candidate) || tryParseLooseJsonObject(candidate);
            if (maybeParsed) {
                parsed = maybeParsed;
                break;
            }
        }
    }

    if (!parsed) {
        const plainResponse = normalizedText
            .replace(/^here is (the )?json requested:?/i, '')
            .replace(/^json:?/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!plainResponse) {
            return safeFallback;
        }

        return {
            emotion: 'normal',
            inner_heart: '',
            response: plainResponse.slice(0, 520),
            narration: '',
        };
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
        emotion: ALLOWED_EMOTIONS.has(emotion) ? emotion : 'normal',
        inner_heart: innerHeart,
        response,
        narration,
    };
};

const extractOpenAIResponseText = (openaiData) => {
    const primaryContent = openaiData?.choices?.[0]?.message?.content;

    if (typeof primaryContent === 'string' && primaryContent.trim()) {
        return primaryContent.trim();
    }

    if (Array.isArray(primaryContent)) {
        const text = primaryContent
            .map((item) => {
                if (typeof item?.text === 'string') {
                    return item.text;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();

        if (text) {
            return text;
        }
    }

    return null;
};

const isStructuredOutputUnsupportedError = (message) => {
    const normalized = String(message || '').toLowerCase();
    const hasStructuredOutputKeyword =
        normalized.includes('response_format') || normalized.includes('json_schema');
    return (
        hasStructuredOutputKeyword ||
        (normalized.includes('structured output') && normalized.includes('not supported'))
    );
};

const isMaxCompletionTokensUnsupportedError = (message) => {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('max_completion_tokens') && normalized.includes('unsupported');
};

const isConnectionRecoverableError = (errorCode) => (
    errorCode === 'UPSTREAM_TIMEOUT' ||
    errorCode === 'UPSTREAM_CONNECTION_FAILED' ||
    errorCode === 'FUNCTION_BUDGET_TIMEOUT'
);

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
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();

        if (!apiKey) {
            return {
                statusCode: 500,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: 'API key not configured. Please set OPENAI_API_KEY in runtime secrets.',
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

        const { systemPrompt, userMessage, messageHistory, characterId } = requestData;

        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: 'userMessage is required and must be a non-empty string.',
                }),
            };
        }

        const MAX_HISTORY_MESSAGES = Number(process.env.MODEL_HISTORY_MESSAGES || process.env.GEMINI_HISTORY_MESSAGES || 10);
        const MAX_PART_CHARS = Number(process.env.MODEL_MAX_PART_CHARS || process.env.GEMINI_MAX_PART_CHARS || 700);
        const MAX_SYSTEM_PROMPT_CHARS = Number(process.env.MODEL_MAX_SYSTEM_PROMPT_CHARS || process.env.GEMINI_MAX_SYSTEM_PROMPT_CHARS || 5000);
        const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS || process.env.GEMINI_MODEL_TIMEOUT_MS || 15000);
        const FUNCTION_TOTAL_TIMEOUT_MS = Number(process.env.FUNCTION_TOTAL_TIMEOUT_MS || 20000);
        const FUNCTION_TIMEOUT_GUARD_MS = Number(process.env.FUNCTION_TIMEOUT_GUARD_MS || 1500);
        const clampText = (value) => String(value ?? '').slice(0, MAX_PART_CHARS);
        const clampSystemPrompt = (value) => String(value ?? '').slice(0, MAX_SYSTEM_PROMPT_CHARS);

        const normalizedCharacterId = String(characterId || '').trim().toLowerCase();
        const clampedSystemPrompt = String(systemPrompt || '').trim()
            ? clampSystemPrompt(String(systemPrompt || '').trim())
            : '';
        const MODEL_NAME = String(process.env.OPENAI_MODEL_NAME || 'gpt-5').trim() || 'gpt-5';

        const openAIMessages = [];

        if (clampedSystemPrompt) {
            openAIMessages.push({
                role: 'system',
                content: clampedSystemPrompt,
            });
        }

        if (messageHistory && Array.isArray(messageHistory)) {
            const recentHistory = messageHistory.slice(-MAX_HISTORY_MESSAGES);
            recentHistory.forEach((msg) => {
                if (msg.role === 'user') {
                    openAIMessages.push({ role: 'user', content: clampText(msg.content) });
                } else if (msg.role === 'assistant') {
                    const assistantText = typeof msg.content === 'object' ? msg.content.response : msg.content;
                    openAIMessages.push({ role: 'assistant', content: clampText(assistantText) });
                }
            });
        }

        openAIMessages.push({
            role: 'user',
            content: clampText(userMessage),
        });

        const getRemainingBudget = () =>
            FUNCTION_TOTAL_TIMEOUT_MS - (Date.now() - requestStartedAt);

        const buildRequestPayload = ({
            requestMessages,
            outputTokens,
            useStructuredOutput,
            tokenKey,
        }) => {
            const payload = {
                model: MODEL_NAME,
                messages: requestMessages,
            };

            payload[tokenKey] = outputTokens;

            if (useStructuredOutput) {
                payload.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'vmate_response',
                        strict: true,
                        schema: OPENAI_RESPONSE_SCHEMA,
                    },
                };
            }

            return payload;
        };

        const callOpenAIWithTimeout = async ({ payload, timeoutMs }) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    }
                );

                let data;
                try {
                    data = await response.json();
                } catch {
                    return {
                        ok: false,
                        response,
                        data: null,
                        error: {
                            status: 502,
                            message: 'Invalid response from OpenAI API.',
                            code: 'UPSTREAM_INVALID_RESPONSE',
                        },
                    };
                }

                if (!response.ok || data?.error) {
                    return {
                        ok: false,
                        response,
                        data,
                        error: {
                            status: response.status || 500,
                            message: data?.error?.message || 'Model call failed',
                            code: 'UPSTREAM_MODEL_ERROR',
                        },
                    };
                }

                return {
                    ok: true,
                    response,
                    data,
                    error: null,
                };
            } catch (fetchError) {
                if (fetchError?.name === 'AbortError') {
                    return {
                        ok: false,
                        response: null,
                        data: null,
                        error: {
                            status: 504,
                            message: `Request timeout on model ${MODEL_NAME} (${timeoutMs}ms).`,
                            code: 'UPSTREAM_TIMEOUT',
                        },
                    };
                }

                return {
                    ok: false,
                    response: null,
                    data: null,
                    error: {
                        status: 503,
                        message: 'Failed to connect to OpenAI API. Please try again later.',
                        code: 'UPSTREAM_CONNECTION_FAILED',
                    },
                };
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let openAIResponse;
        let openAIData;
        let lastModelError = null;
        let tokenKey = 'max_completion_tokens';

        const primaryTimeoutMs = Math.min(
            MODEL_TIMEOUT_MS,
            Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
        );

        if (primaryTimeoutMs <= 0) {
            lastModelError = {
                status: 504,
                message: 'Function timeout budget exceeded before model response.',
                code: 'FUNCTION_BUDGET_TIMEOUT',
            };
        } else {
            let primaryResult = await callOpenAIWithTimeout({
                payload: buildRequestPayload({
                    requestMessages: openAIMessages,
                    outputTokens: 320,
                    useStructuredOutput: true,
                    tokenKey,
                }),
                timeoutMs: primaryTimeoutMs,
            });

            if (
                !primaryResult.ok &&
                primaryResult.error?.code === 'UPSTREAM_MODEL_ERROR' &&
                isMaxCompletionTokensUnsupportedError(primaryResult.error?.message)
            ) {
                tokenKey = 'max_tokens';
                const tokenFallbackTimeoutMs = Math.min(
                    MODEL_TIMEOUT_MS,
                    Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
                );

                if (tokenFallbackTimeoutMs > 0) {
                    primaryResult = await callOpenAIWithTimeout({
                        payload: buildRequestPayload({
                            requestMessages: openAIMessages,
                            outputTokens: 320,
                            useStructuredOutput: true,
                            tokenKey,
                        }),
                        timeoutMs: tokenFallbackTimeoutMs,
                    });
                }
            }

            if (
                !primaryResult.ok &&
                primaryResult.error?.code === 'UPSTREAM_MODEL_ERROR' &&
                isStructuredOutputUnsupportedError(primaryResult.error?.message)
            ) {
                const fallbackFormatTimeoutMs = Math.min(
                    MODEL_TIMEOUT_MS,
                    Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
                );

                if (fallbackFormatTimeoutMs > 0) {
                    primaryResult = await callOpenAIWithTimeout({
                        payload: buildRequestPayload({
                            requestMessages: openAIMessages,
                            outputTokens: 320,
                            useStructuredOutput: false,
                            tokenKey,
                        }),
                        timeoutMs: fallbackFormatTimeoutMs,
                    });
                }
            }

            if (primaryResult.ok) {
                openAIResponse = primaryResult.response;
                openAIData = primaryResult.data;
                lastModelError = null;
            } else {
                lastModelError = primaryResult.error;

                const shouldRunRecoveryAttempt =
                    lastModelError?.code === 'UPSTREAM_TIMEOUT' ||
                    lastModelError?.code === 'UPSTREAM_CONNECTION_FAILED';

                if (shouldRunRecoveryAttempt) {
                    const recoveryTimeoutMs = Math.min(
                        7000,
                        Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
                    );

                    if (recoveryTimeoutMs > 0) {
                        const minimalSystemPrompt = clampedSystemPrompt.slice(
                            0,
                            Math.min(MAX_SYSTEM_PROMPT_CHARS, 900)
                        );
                        const minimalMessages = [];

                        if (minimalSystemPrompt) {
                            minimalMessages.push({
                                role: 'system',
                                content: minimalSystemPrompt,
                            });
                        }

                        minimalMessages.push({
                            role: 'user',
                            content: clampText(userMessage),
                        });

                        const recoveryResult = await callOpenAIWithTimeout({
                            payload: buildRequestPayload({
                                requestMessages: minimalMessages,
                                outputTokens: 220,
                                useStructuredOutput: false,
                                tokenKey,
                            }),
                            timeoutMs: recoveryTimeoutMs,
                        });

                        if (recoveryResult.ok) {
                            openAIResponse = recoveryResult.response;
                            openAIData = recoveryResult.data;
                            lastModelError = null;
                        } else {
                            lastModelError = recoveryResult.error;
                        }
                    }
                }
            }
        }

        if (!openAIResponse || !openAIData) {
            const upstreamErrorCode = lastModelError?.code || 'UPSTREAM_UNKNOWN_ERROR';

            if (isConnectionRecoverableError(upstreamErrorCode)) {
                const fallbackPayload = buildUpstreamFallbackPayload(normalizedCharacterId);
                return {
                    statusCode: 200,
                    headers: withElapsedHeader(headers, requestStartedAt),
                    body: JSON.stringify({
                        text: JSON.stringify(fallbackPayload),
                        cachedContent: null,
                        error_code: upstreamErrorCode,
                        elapsed_ms: Math.max(0, Date.now() - requestStartedAt),
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

        if (!openAIResponse.ok || openAIData.error) {
            let errorMessage = 'Failed to get response from OpenAI API';
            let errorCode = 'UPSTREAM_MODEL_ERROR';

            if (openAIData.error) {
                if (openAIData.error.message?.includes('API key') || openAIData.error.message?.includes('api_key')) {
                    errorMessage = 'Invalid or expired API key. Please check your OPENAI_API_KEY in runtime secrets.';
                    errorCode = 'UPSTREAM_AUTH_ERROR';
                } else if (openAIData.error.message?.includes('quota') || openAIData.error.message?.includes('billing')) {
                    errorMessage = 'OpenAI API quota exceeded. Please check your billing and usage limits.';
                    errorCode = 'UPSTREAM_QUOTA_EXCEEDED';
                } else if (openAIData.error.message?.includes('model') && openAIData.error.message?.includes('not found')) {
                    errorMessage = `OpenAI model not found: ${MODEL_NAME}. Check OPENAI_MODEL_NAME.`;
                    errorCode = 'UPSTREAM_MODEL_NOT_FOUND';
                } else {
                    errorMessage = openAIData.error.message || errorMessage;
                }
            }

            return {
                statusCode: openAIResponse.status || 500,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    error: errorMessage,
                    error_code: errorCode,
                }),
            };
        }

        let modelText = extractOpenAIResponseText(openAIData);
        if (!modelText) {
            console.warn('[V-MATE] Empty OpenAI response text', {
                finishReason: openAIData?.choices?.[0]?.finish_reason || null,
            });

            const emptyRecoveryTimeoutMs = Math.min(
                5000,
                Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
            );

            if (emptyRecoveryTimeoutMs > 0) {
                const minimalSystemPrompt = clampedSystemPrompt.slice(
                    0,
                    Math.min(MAX_SYSTEM_PROMPT_CHARS, 700)
                );
                const emptyRecoveryMessages = [];

                if (minimalSystemPrompt) {
                    emptyRecoveryMessages.push({
                        role: 'system',
                        content: minimalSystemPrompt,
                    });
                }

                emptyRecoveryMessages.push({
                    role: 'user',
                    content: clampText(userMessage),
                });

                const emptyRecoveryResult = await callOpenAIWithTimeout({
                    payload: buildRequestPayload({
                        requestMessages: emptyRecoveryMessages,
                        outputTokens: 180,
                        useStructuredOutput: false,
                        tokenKey,
                    }),
                    timeoutMs: emptyRecoveryTimeoutMs,
                });

                if (emptyRecoveryResult.ok) {
                    const recoveredText = extractOpenAIResponseText(emptyRecoveryResult.data);
                    if (recoveredText) {
                        openAIResponse = emptyRecoveryResult.response;
                        openAIData = emptyRecoveryResult.data;
                        modelText = recoveredText;
                    } else {
                        console.warn('[V-MATE] Empty recovery response text after retry', {
                            finishReason: emptyRecoveryResult.data?.choices?.[0]?.finish_reason || null,
                        });
                    }
                }
            }
        }

        if (!modelText) {
            const fallbackPayload = buildUpstreamFallbackPayload(normalizedCharacterId);
            return {
                statusCode: 200,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify({
                    text: JSON.stringify(fallbackPayload),
                    cachedContent: null,
                    error_code: 'UPSTREAM_EMPTY_RESPONSE',
                    elapsed_ms: Math.max(0, Date.now() - requestStartedAt),
                }),
            };
        }

        const normalizedPayload = normalizeAssistantPayload(modelText);
        const isFormatFallback =
            normalizedPayload.response === '잠시 응답 형식이 불안정했어요. 한 번만 다시 말해줘.' &&
            normalizedPayload.inner_heart === '';

        const finalPayload = isFormatFallback
            ? buildUpstreamFallbackPayload(normalizedCharacterId)
            : normalizedPayload;

        return {
            statusCode: 200,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify({
                text: JSON.stringify(finalPayload),
                cachedContent: null,
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
