# AGENTS.md

## Purpose

V-MATE is a character chat platform that combines characters, worlds, rooms, Supabase data/storage, Gemini calls, and a Cloudflare Worker runtime.

## Structure

- `src/`: React/Vite frontend.
- `server/`: Worker/server modules, auth guardrails, API behavior, and tests.
- `supabase/`: schema and operational SQL.
- `wrangler.jsonc`: Cloudflare Worker configuration.

## Safe commands

```bash
npm install
npm run typecheck
npm test
npm run build
npm run verify
```

## Risk boundaries

- Do not deploy, update Cloudflare vars/secrets, or run Supabase writes without explicit approval.
- Do not expose `GOOGLE_API_KEY`, Supabase keys, owner IDs, or Cloudflare tokens.
- Auth, owner checks, image upload/storage, rate limits, and chat model calls are high-risk surfaces.

## Reporting

Report changed files, verification commands, pass/fail status, and rollout/rollback notes.
