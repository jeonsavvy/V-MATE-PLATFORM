/**
 * Cloudflare Worker Chat Handler: Gemini API 중계 서버
 * - API key 은닉
 * - Origin allowlist 기반 CORS
 * - Origin/IP 기반 rate limit
 * - Gemini 응답 JSON 정규화
 */
import { createHash } from 'node:crypto';
import { getSystemPromptForCharacter, isSupportedCharacterId } from './prompts.js';
import { buildHeaders, checkRateLimit, getClientKey, isOriginAllowed } from './modules/http-policy.js';
import {
    JSON_RESPONSE_SCHEMA,
    extractGeminiResponseText,
    normalizeAssistantPayload,
    toSafeLogPreview,
} from './modules/response-normalizer.js';
import {
    buildGeminiRequestPayload,
    callGeminiWithTimeout,
    createPromptCacheEntry,
    isCacheLookupErrorMessage,
} from './modules/gemini-client.js';
import {
    getGeminiContextCacheConfig,
    getGeminiRetryConfig,
    getGeminiThinkingLevel,
    getRequestBodyLimitBytes,
    shouldUseGeminiContextCache,
} from './modules/runtime-config.js';

const promptCacheStore = new Map();
const FIXED_GEMINI_MODEL_NAME = 'gemini-3-flash-preview';

const getRequestApiVersion = (event, requestData) => {
    const headerVersion =
        event?.headers?.['x-v-mate-api-version'] || event?.headers?.['X-V-MATE-API-Version'];
    const bodyVersion = requestData?.api_version;
    const resolved = String(bodyVersion || headerVersion || '2').trim();
    return resolved === '1' ? '1' : '2';
};

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

const withElapsedHeader = (headers, startedAtMs) => ({
    ...headers,
    'X-V-MATE-Elapsed-Ms': String(Math.max(0, Date.now() - startedAtMs)),
});

const buildErrorPayload = ({ error, errorCode, traceId, retryable = false, details }) => ({
    error,
    error_code: errorCode,
    trace_id: traceId,
    ...(retryable ? { retryable: true } : {}),
    ...(details ? { details } : {}),
});

export const handler = async (event, context) => {
    const requestStartedAt = Date.now();
    const requestTraceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const origin = event.headers?.origin || event.headers?.Origin;
    const originAllowed = isOriginAllowed(origin);
    const headers = {
        ...buildHeaders(originAllowed, origin),
        'X-V-MATE-Trace-Id': requestTraceId,
    };

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
        const bodyText = String(event.body || '');
        const bodyByteLength = new TextEncoder().encode(bodyText).length;
        if (bodyByteLength > getRequestBodyLimitBytes()) {
            return {
                statusCode: 413,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'Request body is too large.',
                        errorCode: 'REQUEST_BODY_TOO_LARGE',
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        if (!apiKey) {
            return {
                statusCode: 500,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'API key not configured. Please set GOOGLE_API_KEY in runtime secrets.',
                        errorCode: 'SERVER_API_KEY_NOT_CONFIGURED',
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        // 요청 본문 파싱 및 검증
        let requestData;
        try {
            requestData = JSON.parse(bodyText);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'Invalid request body. Expected JSON format.',
                        errorCode: 'INVALID_REQUEST_BODY',
                        traceId: requestTraceId,
                        details: parseError.message,
                    })
                ),
            };
        }

        if (!requestData || typeof requestData !== 'object' || Array.isArray(requestData)) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'Invalid request body. Expected JSON object.',
                        errorCode: 'INVALID_REQUEST_BODY',
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        const requestApiVersion = getRequestApiVersion(event, requestData);
        headers['X-V-MATE-API-Version'] = requestApiVersion;

        const { userMessage, messageHistory, characterId, cachedContent } = requestData;
        const normalizedCharacterId = String(characterId || '').trim().toLowerCase();

        if (!isSupportedCharacterId(normalizedCharacterId)) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'characterId is required and must be one of mika | alice | kael.',
                        errorCode: 'INVALID_CHARACTER_ID',
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
            return {
                statusCode: 400,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'userMessage is required and must be a non-empty string.',
                        errorCode: 'INVALID_USER_MESSAGE',
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        const MAX_HISTORY_MESSAGES = Number(process.env.GEMINI_HISTORY_MESSAGES || 10);
        const MAX_PART_CHARS = Number(process.env.GEMINI_MAX_PART_CHARS || 700);
        const MAX_SYSTEM_PROMPT_CHARS = Number(process.env.GEMINI_MAX_SYSTEM_PROMPT_CHARS || 5000);
        const PRIMARY_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1024);
        const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_MODEL_TIMEOUT_MS || 15000);
        const FUNCTION_TOTAL_TIMEOUT_MS = Number(process.env.FUNCTION_TOTAL_TIMEOUT_MS || 20000);
        const FUNCTION_TIMEOUT_GUARD_MS = Number(process.env.FUNCTION_TIMEOUT_GUARD_MS || 1500);
        const clampText = (value) => String(value ?? '').slice(0, MAX_PART_CHARS);
        const clampSystemPrompt = (value) => String(value ?? '').slice(0, MAX_SYSTEM_PROMPT_CHARS);

        const requestCachedContent = parseCachedContentName(cachedContent);
        const trimmedSystemPrompt = String(getSystemPromptForCharacter(normalizedCharacterId) || '').trim();
        const clampedSystemPrompt = trimmedSystemPrompt ? clampSystemPrompt(trimmedSystemPrompt) : '';
        const MODEL_NAME = FIXED_GEMINI_MODEL_NAME;
        const GEMINI_THINKING_LEVEL = getGeminiThinkingLevel();
        const {
            cacheLookupRetryEnabled,
            networkRecoveryRetryEnabled,
            emptyResponseRetryEnabled,
        } = getGeminiRetryConfig();
        const logMeta = {
            traceId: requestTraceId,
            characterId: normalizedCharacterId || null,
        };

        const canUseContextCache =
            shouldUseGeminiContextCache() &&
            Boolean(trimmedSystemPrompt);

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

        const getRemainingBudget = () =>
            FUNCTION_TOTAL_TIMEOUT_MS - (Date.now() - requestStartedAt);

        if (canUseContextCache && !cachedContentName) {
            const {
                warmupMinChars,
                autoCreateEnabled,
                ttlSeconds,
                createTimeoutMs,
            } = getGeminiContextCacheConfig();
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
                    systemPrompt: clampedSystemPrompt,
                    cacheKey: promptCacheKey,
                    ttlSeconds,
                    createTimeoutMs,
                });

                if (createdCache?.name) {
                    cachedContentName = createdCache.name;
                    promptCacheStore.set(promptCacheKey, createdCache);
                }
            }
        }

        let geminiResponse;
        let geminiData;
        let lastModelError = null;

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
            let primaryResult = await callGeminiWithTimeout({
                apiKey,
                modelName: MODEL_NAME,
                payload: buildGeminiRequestPayload({
                    requestContents: contents,
                    outputTokens: PRIMARY_MAX_OUTPUT_TOKENS,
                    thinkingLevel: GEMINI_THINKING_LEVEL,
                    responseSchema: JSON_RESPONSE_SCHEMA,
                    cachedContentName,
                    systemPromptText: cachedContentName ? '' : clampedSystemPrompt,
                }),
                timeoutMs: primaryTimeoutMs,
            });

            if (
                !primaryResult.ok &&
                primaryResult.error?.code === 'UPSTREAM_MODEL_ERROR' &&
                cachedContentName &&
                cacheLookupRetryEnabled &&
                isCacheLookupErrorMessage(primaryResult.error?.message)
            ) {
                console.warn('[V-MATE] Cached content lookup failed, retrying without cache', {
                    ...logMeta,
                    errorCode: primaryResult.error?.code || null,
                    errorStatus: primaryResult.error?.status || null,
                    errorMessage: primaryResult.error?.message || null,
                    hadCachedContent: Boolean(cachedContentName),
                });
                removePromptCache(promptCacheKey);
                cachedContentName = null;

                const cacheResetRetryTimeoutMs = Math.min(
                    MODEL_TIMEOUT_MS,
                    Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
                );

                if (cacheResetRetryTimeoutMs > 0) {
                    primaryResult = await callGeminiWithTimeout({
                        apiKey,
                        modelName: MODEL_NAME,
                        payload: buildGeminiRequestPayload({
                            requestContents: contents,
                            outputTokens: PRIMARY_MAX_OUTPUT_TOKENS,
                            thinkingLevel: GEMINI_THINKING_LEVEL,
                            responseSchema: JSON_RESPONSE_SCHEMA,
                            cachedContentName,
                            useCachedContent: false,
                            systemPromptText: clampedSystemPrompt,
                        }),
                        timeoutMs: cacheResetRetryTimeoutMs,
                    });
                }
            }

            if (primaryResult.ok) {
                geminiResponse = primaryResult.response;
                geminiData = primaryResult.data;
                lastModelError = null;
            } else {
                lastModelError = primaryResult.error;
                console.warn('[V-MATE] Primary Gemini call failed', {
                    ...logMeta,
                    errorCode: lastModelError?.code || null,
                    errorStatus: lastModelError?.status || null,
                    errorMessage: lastModelError?.message || null,
                    hadCachedContent: Boolean(cachedContentName),
                    networkRecoveryRetryEnabled,
                });

                const shouldRunRecoveryAttempt =
                    networkRecoveryRetryEnabled &&
                    (
                        lastModelError?.code === 'UPSTREAM_TIMEOUT' ||
                        lastModelError?.code === 'UPSTREAM_CONNECTION_FAILED'
                    );

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
                        const minimalContents = [
                            {
                                role: 'user',
                                parts: [{ text: clampText(userMessage) }],
                            },
                        ];

                        const recoveryResult = await callGeminiWithTimeout({
                            apiKey,
                            modelName: MODEL_NAME,
                            payload: buildGeminiRequestPayload({
                                requestContents: minimalContents,
                                outputTokens: 220,
                                thinkingLevel: GEMINI_THINKING_LEVEL,
                                responseSchema: JSON_RESPONSE_SCHEMA,
                                cachedContentName,
                                useCachedContent: false,
                                systemPromptText: minimalSystemPrompt,
                            }),
                            timeoutMs: recoveryTimeoutMs,
                        });

                        if (recoveryResult.ok) {
                            geminiResponse = recoveryResult.response;
                            geminiData = recoveryResult.data;
                            lastModelError = null;
                            console.warn('[V-MATE] Gemini recovery attempt succeeded', {
                                ...logMeta,
                                recoveryTimeoutMs,
                            });
                        } else {
                            lastModelError = recoveryResult.error;
                            console.warn('[V-MATE] Gemini recovery attempt failed', {
                                ...logMeta,
                                errorCode: lastModelError?.code || null,
                                errorStatus: lastModelError?.status || null,
                                errorMessage: lastModelError?.message || null,
                                recoveryTimeoutMs,
                            });
                        }
                    }
                } else if (
                    !networkRecoveryRetryEnabled &&
                    (lastModelError?.code === 'UPSTREAM_TIMEOUT' ||
                        lastModelError?.code === 'UPSTREAM_CONNECTION_FAILED')
                ) {
                    console.warn('[V-MATE] Network recovery retry skipped by config', {
                        ...logMeta,
                        errorCode: lastModelError?.code || null,
                    });
                }
            }
        }

        if (!geminiResponse || !geminiData) {
            const upstreamErrorCode = lastModelError?.code || 'UPSTREAM_UNKNOWN_ERROR';
            const isRetryableNetworkFailure =
                upstreamErrorCode === 'UPSTREAM_CONNECTION_FAILED' ||
                upstreamErrorCode === 'UPSTREAM_TIMEOUT' ||
                upstreamErrorCode === 'FUNCTION_BUDGET_TIMEOUT';

            console.warn('[V-MATE] Returning hard error for upstream failure', {
                ...logMeta,
                upstreamErrorCode,
                elapsedMs: Math.max(0, Date.now() - requestStartedAt),
            });

            return {
                statusCode: lastModelError?.status || 503,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: lastModelError?.message || 'Model call failed. Please try again later.',
                        errorCode: upstreamErrorCode,
                        traceId: requestTraceId,
                        retryable: isRetryableNetworkFailure,
                    })
                ),
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
                body: JSON.stringify(
                    buildErrorPayload({
                        error: errorMessage,
                        errorCode,
                        traceId: requestTraceId,
                    })
                ),
            };
        }

        let modelText = extractGeminiResponseText(geminiData);
        if (!modelText) {
            console.warn('[V-MATE] Empty Gemini response text', {
                ...logMeta,
                finishReason: geminiData?.candidates?.[0]?.finishReason || null,
                promptBlockReason: geminiData?.promptFeedback?.blockReason || null,
                emptyResponseRetryEnabled,
            });

            if (cachedContentName) {
                removePromptCache(promptCacheKey);
                cachedContentName = null;
            }

            const emptyRecoveryTimeoutMs = Math.min(
                5000,
                Math.max(0, getRemainingBudget() - FUNCTION_TIMEOUT_GUARD_MS)
            );

            if (emptyResponseRetryEnabled && emptyRecoveryTimeoutMs > 0) {
                const minimalSystemPrompt = clampedSystemPrompt.slice(
                    0,
                    Math.min(MAX_SYSTEM_PROMPT_CHARS, 700)
                );
                const emptyRecoveryContents = [{
                    role: 'user',
                    parts: [{ text: clampText(userMessage) }],
                }];

                const emptyRecoveryResult = await callGeminiWithTimeout({
                    apiKey,
                    modelName: MODEL_NAME,
                    payload: buildGeminiRequestPayload({
                        requestContents: emptyRecoveryContents,
                        outputTokens: 180,
                        thinkingLevel: GEMINI_THINKING_LEVEL,
                        responseSchema: JSON_RESPONSE_SCHEMA,
                        cachedContentName,
                        useCachedContent: false,
                        useJsonMimeType: true,
                        systemPromptText: minimalSystemPrompt,
                    }),
                    timeoutMs: emptyRecoveryTimeoutMs,
                });

                if (emptyRecoveryResult.ok) {
                    const recoveredText = extractGeminiResponseText(emptyRecoveryResult.data);
                    if (recoveredText) {
                        geminiResponse = emptyRecoveryResult.response;
                        geminiData = emptyRecoveryResult.data;
                        modelText = recoveredText;
                        console.warn('[V-MATE] Empty-response recovery attempt succeeded', {
                            ...logMeta,
                            emptyRecoveryTimeoutMs,
                        });
                    } else {
                        console.warn('[V-MATE] Empty recovery response text after retry', {
                            ...logMeta,
                            finishReason: emptyRecoveryResult.data?.candidates?.[0]?.finishReason || null,
                            promptBlockReason: emptyRecoveryResult.data?.promptFeedback?.blockReason || null,
                        });
                    }
                }
            } else if (!emptyResponseRetryEnabled) {
                console.warn('[V-MATE] Empty-response recovery retry skipped by config', {
                    ...logMeta,
                });
            }
        }

        if (!modelText) {
            const finishReason = geminiData?.candidates?.[0]?.finishReason || null;
            const emptyResponseErrorCode =
                finishReason === 'MAX_TOKENS'
                    ? 'UPSTREAM_EMPTY_RESPONSE_MAX_TOKENS'
                    : 'UPSTREAM_EMPTY_RESPONSE';
            console.warn('[V-MATE] Returning hard error for empty model text', {
                ...logMeta,
                errorCode: emptyResponseErrorCode,
                finishReason,
                promptBlockReason: geminiData?.promptFeedback?.blockReason || null,
            });
            return {
                statusCode: 502,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'Gemini returned an empty response. Please retry.',
                        errorCode: emptyResponseErrorCode,
                        traceId: requestTraceId,
                        retryable: true,
                    })
                ),
            };
        }

        const normalizedPayload = normalizeAssistantPayload(modelText, {
            ...logMeta,
            finishReason: geminiData?.candidates?.[0]?.finishReason || null,
            promptBlockReason: geminiData?.promptFeedback?.blockReason || null,
        });
        const isFormatFallback =
            normalizedPayload.response === '잠시 응답 형식이 불안정했어요. 한 번만 다시 말해줘.' &&
            normalizedPayload.inner_heart === '';
        if (isFormatFallback) {
            console.warn('[V-MATE] Returning hard error for format fallback payload', {
                ...logMeta,
                rawModelTextPreview: toSafeLogPreview(modelText),
            });
            if (cachedContentName) {
                removePromptCache(promptCacheKey);
                cachedContentName = null;
            }
            return {
                statusCode: 502,
                headers: withElapsedHeader(headers, requestStartedAt),
                body: JSON.stringify(
                    buildErrorPayload({
                        error: 'Gemini response format validation failed.',
                        errorCode: 'UPSTREAM_INVALID_FORMAT',
                        traceId: requestTraceId,
                    })
                ),
            };
        }
        const finalPayload = normalizedPayload;
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
            body: JSON.stringify(
                requestApiVersion === '1'
                    ? {
                        text: JSON.stringify(finalPayload),
                        cachedContent: responseCachedContent,
                        trace_id: requestTraceId,
                        api_version: '1',
                    }
                    : {
                        message: finalPayload,
                        cachedContent: responseCachedContent,
                        trace_id: requestTraceId,
                        api_version: '2',
                    }
            ),
        };
    } catch (error) {
        console.error('[V-MATE] Unexpected error:', error?.message || error);

        return {
            statusCode: 500,
            headers: withElapsedHeader(headers, requestStartedAt),
            body: JSON.stringify(
                buildErrorPayload({
                    error: 'Internal server error. Please try again later.',
                    errorCode: 'INTERNAL_SERVER_ERROR',
                    traceId: requestTraceId,
                    details: process.env.CLOUDFLARE_DEV ? error.message : undefined,
                })
            ),
        };
    }
};
