export const getRequestBodyLimitBytes = () => Number(process.env.REQUEST_BODY_MAX_BYTES || 32 * 1024);

export const shouldUseGeminiContextCache = () =>
    String(process.env.GEMINI_CONTEXT_CACHE_ENABLED || 'true').toLowerCase() !== 'false';

export const getGeminiContextCacheConfig = () => ({
    ttlSeconds: Number(process.env.GEMINI_CONTEXT_CACHE_TTL_SECONDS || 21600),
    createTimeoutMs: Number(process.env.GEMINI_CONTEXT_CACHE_CREATE_TIMEOUT_MS || 1800),
    warmupMinChars: Number(process.env.GEMINI_CONTEXT_CACHE_WARMUP_MIN_CHARS || 1200),
    autoCreateEnabled: String(process.env.GEMINI_CONTEXT_CACHE_AUTO_CREATE || 'false').toLowerCase() !== 'false',
});

export const getGeminiRetryConfig = () => ({
    cacheLookupRetryEnabled:
        String(process.env.GEMINI_CACHE_LOOKUP_RETRY_ENABLED || 'true').toLowerCase() !== 'false',
    networkRecoveryRetryEnabled:
        String(process.env.GEMINI_NETWORK_RECOVERY_RETRY_ENABLED || 'true').toLowerCase() !== 'false',
    emptyResponseRetryEnabled:
        String(process.env.GEMINI_EMPTY_RESPONSE_RETRY_ENABLED || 'false').toLowerCase() === 'true',
});

export const getGeminiThinkingLevel = () => {
    const raw = String(process.env.GEMINI_THINKING_LEVEL || 'minimal').trim().toLowerCase();
    const allowed = new Set(['minimal', 'low', 'medium', 'high']);
    return allowed.has(raw) ? raw : 'minimal';
};

export const shouldAllowAllOrigins = () => {
    return String(process.env.ALLOW_ALL_ORIGINS || 'false').toLowerCase() === 'true';
};

export const shouldAllowRequestsWithoutOrigin = () => {
    return String(process.env.ALLOW_NON_BROWSER_ORIGIN || 'false').toLowerCase() === 'true';
};

export const shouldTrustForwardedFor = () =>
    String(process.env.TRUST_X_FORWARDED_FOR || 'false').toLowerCase() === 'true';

export const getRateLimitConfig = () => {
    return {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
        maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30),
    };
};

