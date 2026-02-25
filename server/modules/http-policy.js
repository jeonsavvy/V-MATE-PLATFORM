import { createHash } from 'node:crypto';
import {
    getRateLimitConfig,
    shouldAllowAllOrigins,
    shouldAllowRequestsWithoutOrigin,
    shouldTrustForwardedFor,
} from './runtime-config.js';

const rateLimitStore = new Map();
let rateLimitGcTick = 0;

export const parseAllowedOrigins = () => {
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

export const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

export const isOriginAllowed = (origin) => {
    if (shouldAllowAllOrigins()) {
        return true;
    }

    if (!origin) {
        return shouldAllowRequestsWithoutOrigin();
    }

    const normalized = normalizeOrigin(origin);
    const allowlist = parseAllowedOrigins();
    return allowlist.has(normalized);
};

const resolveClientIp = (event) => {
    const headers = event?.headers || {};
    const cfConnectingIp = headers['cf-connecting-ip'] || headers['CF-Connecting-IP'];
    if (cfConnectingIp) {
        return String(cfConnectingIp).trim();
    }

    const xRealIp = headers['x-real-ip'] || headers['X-Real-IP'];
    if (xRealIp) {
        return String(xRealIp).trim();
    }

    if (shouldTrustForwardedFor()) {
        const forwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
        if (forwardedFor) {
            const extracted = String(forwardedFor).split(',')[0].trim();
            if (extracted) {
                return extracted;
            }
        }
    }

    return '';
};

export const getClientKey = (event, origin) => {
    const ip = resolveClientIp(event);
    if (ip) return `ip:${ip}`;

    const normalizedOrigin = origin ? normalizeOrigin(origin) : '';
    const userAgent = String(event?.headers?.['user-agent'] || event?.headers?.['User-Agent'] || '').trim();
    const fingerprintSource = `${normalizedOrigin}|${userAgent}`;
    if (fingerprintSource && fingerprintSource !== '|') {
        const fingerprint = createHash('sha256').update(fingerprintSource).digest('hex').slice(0, 16);
        return `fingerprint:${fingerprint}`;
    }

    if (normalizedOrigin) return `origin:${normalizedOrigin}`;
    return 'anonymous:unknown';
};

export const checkRateLimit = (key) => {
    const { windowMs, maxRequests } = getRateLimitConfig();
    const now = Date.now();
    rateLimitGcTick += 1;

    if (rateLimitGcTick % 200 === 0) {
        for (const [cacheKey, value] of rateLimitStore.entries()) {
            if (!value?.resetAt || now > value.resetAt) {
                rateLimitStore.delete(cacheKey);
            }
        }
    }

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

export const buildHeaders = (originAllowed, origin) => {
    const resolvedOrigin = originAllowed ? (origin || '*') : 'null';

    return {
        'Access-Control-Allow-Origin': resolvedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, X-V-MATE-API-Version',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
        'X-V-MATE-Function': 'chat-v4',
        'Content-Type': 'application/json',
    };
};

