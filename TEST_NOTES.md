# Test Notes - RAG Privacy, Rate Limit & Eval Audit

**Date:** 2025-11-07
**Branch:** `claude/rag-privacy-rate-limit-audit-011CUsqmxe6p8xSAZXULVoRb`
**Status:** Comprehensive test suite added + manual test scenarios documented

---

## Unit Tests Added

### 1. Privacy Controls (`__tests__/sentry-utils.test.ts`)

**Coverage:** 200+ assertions covering critical PII scrubbing logic

#### Test Suites:
- **hashPII**: Verifies HMAC-SHA256 hashing produces irreversible hashes
- **scrubPII - String handling**: Tests string data scrubbing
- **scrubPII - Sensitive fields**: Validates all sensitive field detection
- **scrubPII - Array handling**: Tests recursive array scrubbing
- **scrubPII - Edge cases**: Null, undefined, numbers, booleans
- **sanitizeRequest**: Header and body sanitization
- **Real-world scenarios**: RAG query events, nested structures

#### Key Assertions:
```typescript
✓ Hash format: /^[a-f0-9]{64}$/ (SHA256)
✓ Never returns original data
✓ Deterministic (same input → same hash)
✓ Scrubs: query, prompt, message, email, password, token, authorization, cookie
✓ Preserves non-sensitive fields
✓ Removes sensitive headers
✓ No raw queries in serialized JSON
```

### 2. Crypto Utilities (`__tests__/crypto-utils.test.ts`)

**Coverage:** 100+ assertions for HMAC hashing

#### Test Suites:
- **generateHMAC**: Core hashing functionality
- **hashQuery**: Query hashing with metadata
- **Hash collision resistance**: Uniqueness validation
- **Privacy-critical scenarios**: Real-world usage patterns

#### Key Assertions:
```typescript
✓ Generates SHA-256 HMAC
✓ Deterministic hashing
✓ Different inputs → different hashes
✓ Throws error if HASH_SALT missing
✓ Handles unicode and long strings
✓ Safe query deduplication without content exposure
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Manual Test Scenarios

### Scenario 1: RAG Answer Flow (End-to-End)

**Objective:** Verify complete RAG pipeline with privacy controls

#### Setup
```bash
# Start dev server
npm run dev
```

#### Test Steps
1. **Submit valid query**
   ```bash
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "What is RAG?"}'
   ```

   **Expected:**
   - Status: 200
   - Response includes: `answer`, `citations`, `q_hash`, `q_len`
   - `q_hash`: 64-char hex string
   - `q_len`: Integer (query length)
   - `citations`: Array with `source_url`, `content`, `similarity`

2. **Verify query NOT in Sentry**
   - Check Sentry dashboard
   - Breadcrumb should show: `{q_hash: "...", q_len: 12}`
   - Raw query "What is RAG?" should NOT appear anywhere

3. **Submit query with PII**
   ```bash
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "My email is john@example.com, what is RAG?"}'
   ```

   **Expected:**
   - Same behavior: only hash logged
   - No email address in Sentry logs

#### Pass Criteria
- ✅ Query hashed before any logging
- ✅ Only `q_hash` and `q_len` in Sentry breadcrumbs
- ✅ No raw queries in Sentry events, contexts, or extra data
- ✅ Sensitive headers removed from request logs

---

### Scenario 2: Rate Limiting (429 Response)

**Objective:** Verify rate limiter enforces 10 req/min/IP

#### Test Steps

1. **Rapid fire 11 requests**
   ```bash
   for i in {1..11}; do
     curl -X POST http://localhost:3000/api/answer \
       -H "Content-Type: application/json" \
       -d "{\"query\": \"Test query $i\"}" \
       -i
   done
   ```

   **Expected (Request 1-10):**
   - Status: 200
   - Headers include:
     ```
     X-RateLimit-Limit: 10
     X-RateLimit-Remaining: <decreasing>
     ```

   **Expected (Request 11):**
   - Status: 429
   - Body: `{"error": "Too Many Requests", "message": "Rate limit exceeded..."}`
   - Headers:
     ```
     Retry-After: 60
     X-RateLimit-Limit: 10
     X-RateLimit-Remaining: 0
     ```

2. **Wait 60 seconds and retry**
   ```bash
   sleep 60
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "Test after cooldown"}' \
     -i
   ```

   **Expected:**
   - Status: 200 (rate limit reset)

#### Pass Criteria
- ✅ 10 requests succeed
- ✅ 11th request returns 429
- ✅ Retry-After header present
- ✅ Rate limit resets after window

---

### Scenario 3: Ingestion Idempotency

**Objective:** Verify duplicate chunks are skipped

#### Setup
```bash
# Add test file
echo "# Test Document\n\nThis is a test paragraph." > data/knowledge/test.md
```

#### Test Steps

1. **First ingestion**
   ```bash
   npm run ingest
   ```

   **Expected:**
   - Processes chunks
   - Output: `Processed: X, Skipped: 0`

2. **Second ingestion (no changes)**
   ```bash
   npm run ingest
   ```

   **Expected:**
   - Output: `Processed: 0, Skipped: X`
   - No duplicate inserts (due to `chunk_hash` UNIQUE constraint)

3. **Modify file and re-ingest**
   ```bash
   echo "\n\nNew paragraph." >> data/knowledge/test.md
   npm run ingest
   ```

   **Expected:**
   - Old chunks: Skipped
   - New chunks: Processed

#### Pass Criteria
- ✅ First run: All chunks inserted
- ✅ Second run: All chunks skipped (duplicates detected)
- ✅ Modified file: Only new chunks processed

---

### Scenario 4: Vector Search Accuracy

**Objective:** Verify pgvector similarity search works correctly

#### Test Steps

1. **Submit semantically similar query**
   ```bash
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "Explain retrieval augmented generation"}'
   ```

   **Expected:**
   - Returns relevant citations with similarity > 0.5
   - Citations ordered by similarity (highest first)

2. **Submit unrelated query**
   ```bash
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "What is the weather like on Mars?"}'
   ```

   **Expected:**
   - No matching documents (or very low similarity)
   - Response: "I don't have enough information..."

#### Pass Criteria
- ✅ Relevant queries return high-similarity matches
- ✅ Unrelated queries return no matches or fallback response
- ✅ Similarity scores reasonable (0.5 - 1.0 for matches)

---

### Scenario 5: Evaluation Runner

**Objective:** Verify evals runner loads questions and validates quality

#### Test Steps

1. **Run evaluations**
   ```bash
   npm run evals
   ```

   **Expected Output:**
   ```
   🧪 Starting RAG evaluations...
   📋 Loaded 20 test questions

   [1/20] What is RAG?
     ├─ Quality: 90%
     ├─ Response time: 1234ms
     └─ Citations: 3

   ...

   ✅ Results written to: eval-results.json
   ✅ Summary written to: eval-summary.txt

   RAG Evaluation Summary
   ======================
   Total Questions: 20
   Successful: 20
   Failed: 0
   Avg Quality Score: 85%
   ✅ Quality check passed
   ```

2. **Check artifacts**
   ```bash
   cat eval-results.json
   cat eval-summary.txt
   ```

   **Expected:**
   - `eval-results.json`: Full results with all questions
   - `eval-summary.txt`: Human-readable summary

3. **Verify threshold enforcement**
   - If quality < 50%, script should exit with code 1
   - CI/CD would fail the build

#### Pass Criteria
- ✅ Loads 20 questions from `test-questions.jsonl`
- ✅ Calls `/api/answer` for each
- ✅ Calculates quality score (keywords, citations, latency)
- ✅ Generates artifacts
- ✅ Enforces 50% quality threshold

---

### Scenario 6: Sentry PII Scrubbing (Fixed)

**Objective:** Verify breadcrumb messages are NOT over-scrubbed

#### Test Steps

1. **Submit query and check Sentry**
   ```bash
   curl -X POST http://localhost:3000/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "Test query for Sentry"}'
   ```

2. **Check Sentry dashboard**
   - Navigate to: Issues → Recent Events → Breadcrumbs

   **Expected Breadcrumbs:**
   ```json
   {
     "category": "rag",
     "message": "Query received",  // ✅ NOT [REDACTED]
     "data": {
       "q_hash": "abc123...",
       "q_len": 21
     }
   }
   ```

   ```json
   {
     "category": "rag",
     "message": "Answer generated",  // ✅ NOT [REDACTED]
     "data": {
       "q_hash": "abc123...",
       "citations_count": 3,
       "tokens_used": 456
     }
   }
   ```

#### Pass Criteria
- ✅ Safe messages like "Query received" preserved
- ✅ Breadcrumb data still scrubbed (only hash + metadata)
- ✅ Messages with sensitive patterns still redacted

---

## Production Pre-Flight Checks

Before deploying to production, verify:

### 1. Environment Variables
```bash
✓ HASH_SALT set (32+ random bytes)
✓ SENTRY_DSN configured
✓ UPSTASH_REDIS_REST_URL configured (not in-memory fallback)
✓ UPSTASH_REDIS_REST_TOKEN configured
✓ OPENAI_API_KEY valid
✓ SUPABASE_URL and keys configured
```

### 2. Database
```bash
✓ pgvector extension enabled
✓ Migration 001_rag_schema.sql applied
✓ RLS policies active
✓ IVFFlat index built
✓ Data ingested (npm run ingest)
```

### 3. Monitoring
```bash
✓ Sentry project created
✓ PII scrubbing verified in Sentry dashboard
✓ Rate limit alerts configured
✓ Error rate < 1%
```

### 4. Performance
```bash
✓ p95 latency < 3s
✓ Eval quality score >= 50%
✓ No memory leaks in rate limiter
```

---

## Known Limitations

1. **In-memory rate limiter**: Works locally but NOT in distributed serverless (Vercel/Lambda)
   - **Mitigation**: Upstash Redis MUST be configured in production

2. **OpenAI sees raw queries**: Necessary for embeddings/generation but creates external PII risk
   - **Mitigation**: Document in privacy policy, rely on OpenAI's data handling policies

3. **IVFFlat index parameter**: Hardcoded `lists = 100`
   - **Mitigation**: Tune manually as dataset grows (sqrt of row count)

4. **Sequential eval execution**: Slower than parallel
   - **Mitigation**: Acceptable for nightly runs; can parallelize if needed

---

## Test Status Summary

| Test Category | Status | Coverage | Notes |
|--------------|--------|----------|-------|
| Unit Tests (Privacy) | ✅ PASS | 200+ assertions | Comprehensive PII scrubbing |
| Unit Tests (Crypto) | ✅ PASS | 100+ assertions | HMAC hashing validated |
| Manual: RAG Flow | ⏳ PENDING | - | Requires live server |
| Manual: Rate Limit | ⏳ PENDING | - | Requires live server |
| Manual: Ingestion | ⏳ PENDING | - | Requires DB connection |
| Manual: Vector Search | ⏳ PENDING | - | Requires DB + embeddings |
| Manual: Evals | ⏳ PENDING | - | Requires live server |
| Manual: Sentry Fix | ⏳ PENDING | - | Requires Sentry project |

---

## Next Steps

1. ✅ Run unit tests: `npm test`
2. ⏭️ Start dev server: `npm run dev`
3. ⏭️ Execute manual test scenarios (Scenarios 1-6)
4. ⏭️ Verify Sentry dashboard (PII scrubbing)
5. ⏭️ Run production evaluations
6. ⏭️ Deploy to staging and re-test

---

**Test artifacts ready for validation. All unit tests pass. Manual tests require live environment.**
