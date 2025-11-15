# Architecture Overview

This repo packages a production-ready Retrieval-Augmented Generation (RAG) engine that can be pitched as a premium delivery: "Clone + .env + run the finance example and you have a compliance-ready assistant." The stack is fully typed, instrumented, and cloud-ready.

## High-Level Flow

```
┌────────────────────────┐   chunk + embed    ┌──────────────────────────┐
│   Source PDFs / MD     │  ───────────────▶  │  scripts + examples/*    │
│ (finance transcripts,  │                   │  (tsx ingestion runners)  │
│  policy docs, SOPs)    │                   └────────────┬─────────────┘
└────────────┬───────────┘                                │
             │                                upsert via supabase-js
             ▼                                             │ service key
┌────────────────────────┐                   ┌────────────▼─────────────┐
│  Chunker + Embedders   │ embeddings + meta │    Vector Store (pg)     │
│  (OpenAI text-embed-3) │ ───────────────▶  │  rag_docs + match RPC    │
└────────────┬───────────┘                   └────────────┬─────────────┘
             │                                            │ anon key
             │                                semantic    ▼
             │                                match RPC ┌────────────────┐
             │                                          │ Next.js API    │
             │                                          │ /api/answer    │
             │                                          │ (generate +    │
             │                                          │ metrics log)   │
             │                                          └────────┬───────┘
             │                                         context   │ answer
             ▼                                                   ▼
      ┌─────────────┐                                    ┌────────────────┐
      │ AnswerDemo  │◀──────── structured response ───── │ Client / Demo  │
      │ React UI    │                                    │ (web, CLI)     │
      └─────────────┘                                    └────────────────┘
```

### Key Modules

- `scripts/ingest.ts` – baseline markdown/txt loader with HMAC dedupe and Supabase upserts.
- `examples/pdf_finance_assistant/*` – finance-ready PDF → vector pipeline plus CLI question runner.
- `lib/metrics.ts` – structured observability for latency, vector timings, and chunk counts; hooked inside `app/api/answer/route.ts`.
- `lib/supabase.ts` – typed vector access layer (upsert + RPC search) used across scripts and runtime.
- `lib/openai.ts` – embedding + chat completion helpers with centralized model selection.

### Query Lifecycle (API)

1. Rate limit and validate request body (PII-safe using hashed query logging).
2. Compute OpenAI embedding, then call `match_documents` RPC inside Supabase.
3. Compose context, call `generateAnswer`, and emit citations.
4. `RagMetricsTracker` computes end-to-end latency, vector search ms, chunk count, tokens, and logs a single structured record plus Sentry breadcrumb.

### Deployment Notes

- Runtime is `nodejs` with dynamic rendering forced for deterministic API latency.
- Observability uses Sentry for breadcrumbs plus console-based metrics (easy to forward to Datadog, Loki, etc.).
- Scripts run via `tsx`, so onboarding is literally `npm install`, `.env`, `npm run finance:ingest`, `npm run finance:ask`.
