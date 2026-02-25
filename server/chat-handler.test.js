import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { handler } from './chat-handler.js';

const TRACKED_ENV_KEYS = [
  'GOOGLE_API_KEY',
  'ALLOWED_ORIGINS',
  'ALLOW_ALL_ORIGINS',
  'ALLOW_NON_BROWSER_ORIGIN',
  'TRUST_X_FORWARDED_FOR',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'REQUEST_BODY_MAX_BYTES',
  'GEMINI_CONTEXT_CACHE_ENABLED',
  'GEMINI_CONTEXT_CACHE_AUTO_CREATE',
  'GEMINI_NETWORK_RECOVERY_RETRY_ENABLED',
  'GEMINI_CACHE_LOOKUP_RETRY_ENABLED',
  'GEMINI_EMPTY_RESPONSE_RETRY_ENABLED',
  'GEMINI_MODEL_TIMEOUT_MS',
  'FUNCTION_TOTAL_TIMEOUT_MS',
  'FUNCTION_TIMEOUT_GUARD_MS',
  'GEMINI_MAX_OUTPUT_TOKENS',
  'GEMINI_HISTORY_MESSAGES',
  'GEMINI_MAX_PART_CHARS',
  'GEMINI_MAX_SYSTEM_PROMPT_CHARS',
  'CLOUDFLARE_DEV',
];

const ORIGINAL_ENV = Object.fromEntries(TRACKED_ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_FETCH = globalThis.fetch;

const restoreTrackedEnv = () => {
  for (const key of TRACKED_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

afterEach(() => {
  restoreTrackedEnv();
  globalThis.fetch = ORIGINAL_FETCH;
});

const applyBaseEnv = (overrides = {}) => {
  const baseEnv = {
    GOOGLE_API_KEY: 'unit-test-api-key',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    ALLOW_ALL_ORIGINS: 'false',
    ALLOW_NON_BROWSER_ORIGIN: 'false',
    TRUST_X_FORWARDED_FOR: 'false',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '1000',
    REQUEST_BODY_MAX_BYTES: '32768',
    GEMINI_CONTEXT_CACHE_ENABLED: 'false',
    GEMINI_CONTEXT_CACHE_AUTO_CREATE: 'false',
    GEMINI_NETWORK_RECOVERY_RETRY_ENABLED: 'false',
    GEMINI_CACHE_LOOKUP_RETRY_ENABLED: 'false',
    GEMINI_EMPTY_RESPONSE_RETRY_ENABLED: 'false',
    GEMINI_MODEL_TIMEOUT_MS: '5000',
    FUNCTION_TOTAL_TIMEOUT_MS: '10000',
    FUNCTION_TIMEOUT_GUARD_MS: '1000',
    GEMINI_MAX_OUTPUT_TOKENS: '256',
    GEMINI_HISTORY_MESSAGES: '10',
    GEMINI_MAX_PART_CHARS: '700',
    GEMINI_MAX_SYSTEM_PROMPT_CHARS: '5000',
    CLOUDFLARE_DEV: 'false',
  };

  for (const [key, value] of Object.entries({ ...baseEnv, ...overrides })) {
    process.env[key] = String(value);
  }
};

const makeEvent = ({
  origin = 'http://localhost:5173',
  body,
  ip,
  apiVersion,
}) => {
  const headers = {
    'content-type': 'application/json',
    ...(origin ? { origin } : {}),
    ...(ip ? { 'cf-connecting-ip': ip } : {}),
    ...(apiVersion ? { 'x-v-mate-api-version': String(apiVersion) } : {}),
  };

  return {
    httpMethod: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
  };
};

const parseBody = (result) => {
  try {
    return JSON.parse(result.body || '{}');
  } catch {
    return {};
  }
};

test('returns 403 when origin is not in allowlist', async () => {
  applyBaseEnv();
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called for rejected origin');
  };

  const result = await handler(
    makeEvent({
      origin: 'https://evil.example',
      body: {
        characterId: 'mika',
        userMessage: '안녕',
        messageHistory: [],
      },
      ip: '198.51.100.11',
    }),
    {}
  );

  assert.equal(result.statusCode, 403);
  assert.match(String(result.body), /Origin is not allowed/i);
});

test('returns 413 for oversized request body', async () => {
  applyBaseEnv({ REQUEST_BODY_MAX_BYTES: '32' });
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called for oversized body');
  };

  const result = await handler(
    makeEvent({
      body: JSON.stringify({ payload: 'x'.repeat(64) }),
      ip: '198.51.100.12',
    }),
    {}
  );

  const payload = parseBody(result);
  assert.equal(result.statusCode, 413);
  assert.equal(payload.error_code, 'REQUEST_BODY_TOO_LARGE');
});

test('returns 400 for invalid characterId schema', async () => {
  applyBaseEnv();
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called for invalid request schema');
  };

  const result = await handler(
    makeEvent({
      body: {
        characterId: 'invalid-character',
        userMessage: '안녕',
        messageHistory: [],
      },
      ip: '198.51.100.13',
    }),
    {}
  );

  const payload = parseBody(result);
  assert.equal(result.statusCode, 400);
  assert.equal(payload.error_code, 'INVALID_CHARACTER_ID');
});

test('returns ChatResponseV2 shape when request succeeds', async () => {
  applyBaseEnv();

  let fetchCalls = 0;
  globalThis.fetch = async (url) => {
    fetchCalls += 1;
    assert.match(String(url), /generateContent\?key=/);

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"emotion":"happy","inner_heart":"기분 좋아","response":"안녕, 선생님!"}',
                },
              ],
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  };

  const result = await handler(
    makeEvent({
      body: {
        characterId: 'mika',
        userMessage: '첫 인사야',
        messageHistory: [],
      },
      ip: '198.51.100.14',
    }),
    {}
  );

  const payload = parseBody(result);
  assert.equal(result.statusCode, 200);
  assert.equal(payload.api_version, '2');
  assert.equal(typeof payload.trace_id, 'string');
  assert.equal(typeof payload.cachedContent, 'object');
  assert.equal(payload.cachedContent, null);
  assert.deepEqual(payload.message, {
    emotion: 'happy',
    inner_heart: '기분 좋아',
    response: '안녕, 선생님!',
    narration: '',
  });
  assert.equal(fetchCalls, 1);
});

test('returns V1-compatible text payload when api version is 1', async () => {
  applyBaseEnv();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"emotion":"normal","inner_heart":"","response":"응답 테스트"}',
                },
              ],
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );

  const result = await handler(
    makeEvent({
      apiVersion: '1',
      body: {
        characterId: 'alice',
        userMessage: '테스트',
        messageHistory: [],
      },
      ip: '198.51.100.15',
    }),
    {}
  );

  const payload = parseBody(result);
  assert.equal(result.statusCode, 200);
  assert.equal(payload.api_version, '1');
  assert.equal(typeof payload.text, 'string');

  const parsedText = JSON.parse(payload.text);
  assert.deepEqual(parsedText, {
    emotion: 'normal',
    inner_heart: '',
    response: '응답 테스트',
    narration: '',
  });
  assert.ok(!('message' in payload));
});
