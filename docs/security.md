# Security & Prompt Defense Playbook

Premium deployments require a repeatable story for how the RAG stack handles abusive or malicious input. This repo now ships with a guard hook plus recommendations for clients to extend.

## Prompt Injection Hook

- File: `lib/prompt-guard.ts`
- Integration point: `app/api/answer/route.ts` before embeddings are generated.
- Behavior: matches the incoming prompt against a handful of high-signal patterns ("ignore previous instructions", "reveal system prompt", script injection markers, etc.).
- Response: by default (no env var) suspicious prompts are logged to Sentry and the request proceeds. Set `PROMPT_GUARD_MODE=block` to return a validation error instead of sending the query to the LLM.

### Client Recommendations

1. **Tighten patterns** – extend `PROMPT_GUARD_PATTERNS` with client-specific red flags like business unit names, privileged commands, or ticketing shortcuts.
2. **Integrate third-party defenders** – swap `evaluatePromptForInjection` with hosted services (Lakera, GigaGuard, etc.) to benefit from ML classifiers.
3. **Add reviewer workflow** – when flagged, drop the prompt + hashed metadata into a queue for analyst approval rather than auto-blocking.
4. **Pair with output filters** – keep a symmetric hook before responding to redact secrets or policy-controlled language.

## Secrets & Environment Hardening

- Store Supabase service keys and OpenAI keys in platform secrets managers (Vercel, AWS SSM, Doppler). `.env` usage is for local dev only.
- Set `METRICS_ADMIN_TOKEN` when deploying `/api/admin/metrics` so only authenticated demos can fetch telemetry.
- Use `RAG_METRICS_LOG_PATH` to redirect metrics logs to a secure volume when hosting on multi-tenant servers.

## Audit Checklist

- ✅ Rate limiting enabled via `/api/answer`
- ✅ Prompt guard hook executed before embeddings
- ✅ Structured metrics + logging with hashed queries only
- ✅ CLI + HTTP metrics demo for quick compliance evidence

Drop this file into internal wikis so teams know where to extend the guard rails.
