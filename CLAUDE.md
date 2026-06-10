# CLAUDE.md

CSBrainAI is a **privacy-first RAG workbench for technical teams** — a product
demo for cited answers, private telemetry, evals, and retrieval architecture.
See `docs/BRAND-BOUNDARY.md` for what this property is and is not; see
`docs/OVERHAUL-PLAN.md` for the active PR plan.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5, Supabase + pgvector (1536-dim,
text-embedding-3-small), gpt-4o-mini generation, Sentry, optional Upstash Redis,
Jest + Vitest, Zod, pdf-parse.

## Privacy invariants (never weaken these — the promise IS the product)

- **Raw user queries are never logged or stored.** Only the salted HMAC-SHA256
  hash (`hashQuery` in `lib/crypto-utils.ts`) plus query length, latency, token
  usage, and citation count. Any new logging or telemetry must follow this rule.
- Sentry events pass through recursive PII scrubbing (`lib/sentry-utils.ts`);
  do not add error reporting that bypasses it.
- `/api/answer` hashes the query first, applies a prompt-injection guard
  (`lib/prompt-guard.ts`) and rate limiting (`lib/rate-limiter.ts`, token
  bucket, 10 req/min/IP), and returns `{ answer, citations[], q_hash, q_len,
  tokensUsed }`.
- Full threat model and compliance notes: `docs/PRIVACY.md`.

## Commands

```bash
npm run dev / build / start
npm run lint            # eslint .
npm run type-check      # tsc --noEmit
npm test                # jest
npm run test:vitest     # vitest run
npm run evals           # scripts/evals-runner.ts over data/evals/test-questions.jsonl
```

### Vertical demo lanes (CLI)

```bash
npm run ingest            # base corpus: data/knowledge/ → Supabase
npm run finance:ingest    # examples/pdf_finance_assistant — PDF finance lane
npm run finance:ask
npm run policy:ingest     # examples/policy_compliance_assistant — config-driven
npm run policy:ask        #   (chunking/thresholds in its config.ts)
npm run metrics:summary   # CLI summary over lib/metrics-store.ts
```

## Gates

`lint`, `type-check`, `jest` + `vitest`, and `build` must pass. Evals must score
≥ 50% overall (scoring: 40% keyword match / 30% citations / 20% non-empty /
10% latency < 5s); they also run nightly via
`.github/workflows/nightly-evals.yml`.

## Layout notes

- `app/api/answer/route.ts` — main RAG endpoint (GET serves API docs);
  `app/api/admin/metrics/route.ts` — metrics endpoint.
- `examples/` — finance, policy, and simple_rag lanes; `examples/shared/env.ts`
  for lane env handling.
- `docs/` is the source of truth (PRIVACY.md, architecture.md, SCHEMA.md,
  ANSWER-FLOW.md, INGEST.md, GO-LIVE-GATE.md). Pages should render or summarize
  these docs, not fork them.
- `docs/upwork/` is sales collateral — Upwork framing stays there only, never in
  the README or product pages.
