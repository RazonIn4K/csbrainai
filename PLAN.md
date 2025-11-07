# RAG Privacy, Rate Limit & Eval Audit - Execution Plan

**Branch:** `claude/rag-privacy-rate-limit-audit-011CUsqmxe6p8xSAZXULVoRb`
**Date:** 2025-11-07
**Objective:** Comprehensive audit of RAG system privacy, rate limiting, and evaluation workflows

---

## Audit Steps

### 1. ✅ Repository Inventory
- [x] Verify branch: `claude/rag-privacy-rate-limit-audit-011CUsqmxe6p8xSAZXULVoRb`
- [x] Clean working directory status
- [x] Identify critical files:
  - API endpoint: `app/api/answer/route.ts`
  - Privacy utils: `lib/sentry-utils.ts`, `lib/crypto-utils.ts`
  - Rate limiter: `lib/rate-limiter.ts`, `middleware.ts`
  - RAG components: `scripts/ingest.ts`, `supabase/migrations/001_rag_schema.sql`
  - Evaluation: `scripts/evals-runner.ts`, `data/evals/test-questions.jsonl`

### 2. ✅ Privacy & Logging Audit
- [x] **Review HMAC hashing implementation** (`lib/crypto-utils.ts`)
  - ✅ HMAC-SHA256 with salt (`HASH_SALT` env var)
  - ✅ Deterministic hashing for deduplication
  - ✅ Returns `{hash, length}` - no raw query

- [x] **Review query handling in `/api/answer`** (`app/api/answer/route.ts:57-70`)
  - ✅ Query hashed immediately: `hashQuery(query)` at line 58
  - ✅ Only `q_hash` and `q_len` logged to Sentry (lines 61-70)
  - ✅ No raw query in breadcrumbs or logs
  - ⚠️ Query passed to OpenAI (necessary but undocumented)

- [x] **Review Sentry PII scrubbing** (`sentry.server.config.ts`)
  - ✅ `beforeSend` hook configured (lines 14-40)
  - ✅ Scrubs request, contexts, extra, breadcrumbs
  - 🐛 **BUG FOUND**: Line 35 over-scrubs breadcrumb messages
    - Current: `message: breadcrumb.message ? '[REDACTED]' : undefined`
    - Issue: Scrubs safe messages like "Query received" and "Answer generated"
    - Fix: Only redact messages containing sensitive patterns

- [x] **Review scrubPII utility** (`lib/sentry-utils.ts`)
  - ✅ Comprehensive sensitive field list (lines 46-55)
  - ✅ Recursive scrubbing for nested objects/arrays
  - ✅ Removes sensitive headers (lines 77-83)

- [x] **Add unit tests** for privacy-critical code
  - ✅ Created `__tests__/sentry-utils.test.ts` (200+ assertions)
  - ✅ Created `__tests__/crypto-utils.test.ts` (100+ assertions)
  - ✅ Added Jest configuration

### 3. ✅ RAG Correctness Audit

- [x] **Review ingestion idempotency** (`scripts/ingest.ts`)
  - ✅ Generates `chunk_hash` via HMAC (line 122)
  - ✅ Uses `upsert` with `onConflict: 'chunk_hash'` (line 79)
  - ✅ Tracks skipped duplicates (lines 140-142)
  - ⚠️ Sequential processing (no batching) - opportunity for optimization

- [x] **Review database schema** (`supabase/migrations/001_rag_schema.sql`)
  - ✅ `chunk_hash` column with UNIQUE constraint (line 12)
  - ✅ Index on `chunk_hash` for fast lookups (line 30)
  - ✅ IVFFlat index on `embedding` with cosine ops (lines 35-38)
  - ⚠️ Hardcoded `lists = 100` - should be dynamic (sqrt of row count)

- [x] **Review match_documents function** (lines 58-83)
  - ✅ Correct similarity calculation: `1 - (embedding <=> query_embedding)`
  - ✅ Threshold filtering: `WHERE similarity > match_threshold`
  - ✅ Proper ordering and limit

- [x] **Review vector search usage** (`lib/supabase.ts:96-117`)
  - ✅ Calls RPC function `match_documents`
  - ✅ Default threshold: 0.5, count: 5
  - ✅ Uses anon client (proper RLS)

### 4. ✅ Rate Limiting Audit

- [x] **Review Upstash configuration** (`lib/rate-limiter.ts`)
  - ✅ Primary: Upstash Redis with sliding window (lines 100-126)
  - ✅ 10 requests per 60-second window (lines 18-22)
  - ✅ Fallback: In-memory token bucket (lines 27-56)
  - ⚠️ In-memory fallback not distributed (won't work across serverless instances)

- [x] **Review middleware integration** (`middleware.ts`)
  - ✅ Applied to all `/api/*` routes (line 39)
  - ✅ Returns 429 status on limit exceeded (line 52)
  - ✅ Includes `Retry-After: 60` header (line 61)
  - ✅ Rate limit headers: X-RateLimit-* (lines 44-48)
  - ⚠️ Fail-open on error (line 69) - intentional but risky

- [x] **Review IP extraction** (`lib/rate-limiter.ts:75-88`)
  - ✅ Checks X-Forwarded-For (handles proxies)
  - ✅ Checks X-Real-IP
  - ✅ Fallback to connection IP

### 5. ✅ Evaluation Workflow Audit

- [x] **Review test questions** (`data/evals/test-questions.jsonl`)
  - ✅ 20 test questions loaded
  - ✅ Covers: concepts, security, technical, architecture
  - ✅ Expected keywords for validation

- [x] **Review evals runner** (`scripts/evals-runner.ts`)
  - ✅ Loads JSONL correctly (lines 58-66)
  - ✅ Calls `/api/answer` for each question (lines 72-102)
  - ✅ Multi-dimensional quality scoring (lines 107-149)
  - ✅ 50% threshold enforced (lines 244-247)
  - ✅ Generates artifacts: `eval-results.json`, `eval-summary.txt`
  - ⚠️ Hardcoded `localhost:3000` - can't test production easily
  - ⚠️ Sequential execution - could parallelize

### 6. ✅ Documentation Review
- [x] README.md - comprehensive architecture and usage
- [x] docs/PRIVACY.md - privacy guarantees documented
- [x] docs/ANSWER-FLOW.md - API flow documented
- [x] docs/SCHEMA.md - database schema documented

---

## Summary of Findings

### 🐛 Critical Issues (Must Fix)
1. **Sentry breadcrumb message over-scrubbing** - Redacts safe messages like "Query received"

### ⚠️ Warnings (Should Address)
2. **In-memory rate limiter fallback** - Won't work in distributed serverless
3. **OpenAI receives raw queries** - Necessary but undocumented in privacy policy
4. **Hardcoded IVFFlat lists parameter** - Should be dynamic
5. **Evals hardcoded to localhost** - Can't test production

### 💡 Optimizations (Nice to Have)
6. **Sequential chunk processing** - Could batch for speed
7. **Sequential eval execution** - Could parallelize requests

---

## Next Steps

1. ✅ Create unit tests for privacy controls
2. ⏭️ Apply fixes for critical issues
3. ⏭️ Generate PATCHSET.diff with changes
4. ⏭️ Create TEST_NOTES.md with test scenarios
5. ⏭️ Create REVIEW.md with risk analysis
6. ⏭️ Commit and push changes

---

**Status:** Audit complete - proceeding to fixes and documentation
