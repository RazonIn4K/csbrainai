# CSBrainAI - RAG Architecture Plan
## Senior Staff Engineer Design Document

**Status:** Implementation Ready
**Level:** L5 (Sentry Integration)
**Branch:** feat/rag-supabase-evals-sentry-security

---

## Executive Summary

Production-grade RAG (Retrieval Augmented Generation) system with privacy-first architecture, vector search via Supabase+pgvector, and comprehensive observability through Sentry. Zero PII logging—all queries stored as {hash, length} only.

### Core Stack
- **Framework:** Next.js 13+ (App Router)
- **Vector DB:** Supabase + pgvector (ivfflat index)
- **Embeddings:** OpenAI text-embedding-3-small (1536-dim)
- **LLM:** OpenAI gpt-4o-mini
- **Observability:** Sentry L5 (PII scrubbing enabled)
- **Security:** CSP headers, rate limiting (Upstash preferred, token bucket fallback)
- **CI/CD:** Nightly evals with artifact archival

---

## System Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│  Next.js App (Vercel/Cloud)         │
│  ┌───────────────────────────────┐  │
│  │ Security Middleware           │  │
│  │ - CSP Headers                 │  │
│  │ - Rate Limiting               │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ /api/answer Route             │  │
│  │ 1. Hash query (HMAC-SHA256)   │  │
│  │ 2. Embed query → OpenAI       │  │
│  │ 3. Vector search → Supabase   │  │
│  │ 4. Build context prompt       │  │
│  │ 5. Generate answer → OpenAI   │  │
│  │ 6. Return {answer, citations, │  │
│  │    q_hash, q_len}             │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Sentry Integration            │  │
│  │ - Client: PII scrubbing       │  │
│  │ - Server: Performance traces  │  │
│  └───────────────────────────────┘  │
└──────────┬─────────────┬────────────┘
           │             │
           ▼             ▼
    ┌─────────────┐  ┌─────────────┐
    │  Supabase   │  │  OpenAI API │
    │  + pgvector │  │  - Embed    │
    │             │  │  - Chat     │
    └─────────────┘  └─────────────┘

Offline Pipeline:
┌──────────────────────────────────┐
│ scripts/ingest.ts                │
│ 1. Read /data/*.{md,txt}         │
│ 2. Chunk (recursive splitter)    │
│ 3. Compute chunk_hash (SHA-256)  │
│ 4. Embed → OpenAI                │
│ 5. Upsert → Supabase (w/ dates)  │
└──────────────────────────────────┘

Nightly CI:
┌──────────────────────────────────┐
│ .github/workflows/nightly-evals  │
│ 1. scripts/evals-runner.js       │
│ 2. 20-Q JSONL benchmark          │
│ 3. POST /api/answer (each Q)     │
│ 4. Upload results artifact       │
│ 5. Soft-fail on minor regressions│
└──────────────────────────────────┘
```

---

## Data Flow & Privacy

### Query Processing (Zero PII Retention)
```typescript
// User query: "How do I use the API?"
const queryHash = hmac('sha256', HASH_SALT, query).digest('hex');
// Store: { q_hash: "a3f5...", q_len: 21 }
// NEVER store: raw query text

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: query // transient, never logged
});
```

### Supabase Schema
```sql
-- supabase/migrations/001_init_rag.sql
create extension if not exists vector;

create table rag_docs (
  id bigserial primary key,
  source_url text not null,
  chunk_hash text unique not null,
  content text not null,
  embedding vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  embedding_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- IVFFlat index for fast approximate search
create index rag_docs_embedding_idx
  on rag_docs
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC for vector search (optional, can use direct client)
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id bigint,
  source_url text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    source_url,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from rag_docs
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Component Design

### 1. Sentry Integration (L5)
**Files:**
- `lib/sentry/client.ts` - Client-side init with PII scrubber
- `lib/sentry/server.ts` - Server-side init with performance tracing
- `instrumentation.ts` - Next.js 13+ instrumentation hook

**PII Scrubbing:**
```typescript
beforeSend(event, hint) {
  // Strip query params, body, headers
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    event.request.url = event.request.url?.split('?')[0];
  }
  // Remove breadcrumb data
  event.breadcrumbs = event.breadcrumbs?.map(b => ({
    ...b,
    data: undefined
  }));
  return event;
}
```

### 2. Security Layer
**Files:**
- `middleware.ts` - Next.js middleware for security headers
- `lib/security/rate-limit.ts` - Upstash Redis or token bucket

**Headers:**
```typescript
const headers = new Headers(response.headers);
headers.set('X-Content-Type-Options', 'nosniff');
headers.set('X-Frame-Options', 'DENY');
headers.set('X-XSS-Protection', '1; mode=block');
headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
headers.set('Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
```

**Rate Limiting:**
- Upstash Redis (preferred): 10 req/min per IP
- Fallback: In-memory token bucket (non-distributed, TODO for scale)

### 3. Ingest Pipeline
**File:** `scripts/ingest.ts`

**Process:**
1. Read `/data/*.{md,txt}` files
2. Chunk using recursive text splitter (1000 chars, 200 overlap)
3. Compute `chunk_hash = SHA-256(source_url + content)`
4. Embed via OpenAI (batch of 100)
5. Upsert to Supabase:
   ```typescript
   await supabase.from('rag_docs').upsert({
     source_url,
     chunk_hash,
     content,
     embedding,
     embedding_model: 'text-embedding-3-small',
     embedding_date: new Date().toISOString().split('T')[0]
   }, { onConflict: 'chunk_hash' });
   ```

### 4. Answer API
**File:** `app/api/answer/route.ts` (Next 13+) or `pages/api/answer.ts`

**Endpoint:** `POST /api/answer`
```typescript
// Request
{ "query": "How do I authenticate?" }

// Response
{
  "answer": "To authenticate, use the API key in the Authorization header...",
  "citations": [
    { "source_url": "docs/auth.md", "snippet": "..." }
  ],
  "q_hash": "a3f5e8b2...",
  "q_len": 24,
  "model": "gpt-4o-mini"
}
```

**Flow:**
1. Rate limit check
2. Hash query: `HMAC-SHA256(HASH_SALT, query)`
3. Embed query via OpenAI
4. Vector search (top-5 via Supabase RPC or client)
5. Build context-only prompt:
   ```
   You are a helpful assistant. Use ONLY the following context to answer.

   Context:
   [Document 1: ...]
   [Document 2: ...]

   Question: {query}
   ```
6. Generate answer via OpenAI Chat (gpt-4o-mini)
7. Log to Sentry: `{ q_hash, q_len, model, latency_ms }`
8. Return response

### 5. Nightly Evaluations
**Files:**
- `.github/workflows/nightly-evals.yml` - Scheduled workflow
- `scripts/evals-runner.js` - Test harness
- `evals/questions.jsonl` - 20 test questions

**Process:**
1. Trigger: Cron schedule (e.g., `0 2 * * *` = 2 AM daily)
2. Run `node scripts/evals-runner.js`:
   - Read `evals/questions.jsonl`
   - For each question: POST to `/api/answer`
   - Record: `{ question, answer, citations, latency, timestamp }`
3. Upload results as artifact
4. Analyze: Flag severe regressions (e.g., >50% failure rate)
5. Soft-fail: Log warning, don't block pipeline (unless critical)

---

## Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...  # For client + ingest
SUPABASE_SERVICE_ROLE=eyJ... # Optional, for CI ingest

# Security
HASH_SALT=random-32-byte-hex  # For HMAC query hashing

# Sentry
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Rate Limiting (optional)
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
```

---

## Acceptance Criteria

- [ ] `/api/answer` returns valid responses with hashed telemetry only
- [ ] Supabase schema deployed with pgvector + ivfflat index
- [ ] Ingest script successfully processes `/data/*.md` files
- [ ] Sentry captures errors with zero PII leakage
- [ ] Security headers present on all responses
- [ ] Rate limiting active (Upstash or fallback)
- [ ] Nightly evals produce artifact in GitHub Actions
- [ ] Policy docs published: Go-Live-Gate.md, Tool-Analytics.md, SECURITY.md, PRIVACY.md
- [ ] CI passes: TypeScript checks, linting, SBOM generation

---

## Deployment Checklist

### Pre-Launch
1. Run `npm run type-check` → Must pass
2. Run `npm run lint` → Must pass
3. Test ingest: `npm run ingest` with sample data
4. Manual test: `curl -X POST http://localhost:3000/api/answer -d '{"query":"test"}'`
5. Verify Sentry events in dashboard (zero PII)

### Go-Live Gate (See Go-Live-Gate.md)
- Security review: CSP, rate limits, PII scrubbing
- Load test: 100 req/s for 5 minutes
- Data residency: Confirm Supabase region compliance
- Legal: PRIVACY.md approved by counsel

### Post-Launch
- Monitor Sentry for errors
- Check nightly eval artifacts for regressions
- Review rate limit logs for abuse patterns

---

## Future Enhancements (Out of Scope)

- [ ] Multi-tenant data isolation (row-level security)
- [ ] Hybrid search (BM25 + vector)
- [ ] Streaming responses (SSE)
- [ ] Feedback loop (thumbs up/down)
- [ ] A/B testing framework
- [ ] Auto-reindexing on data updates

---

**Document Version:** 1.0
**Last Updated:** 2025-11-06
**Owner:** Senior Staff Engineer
