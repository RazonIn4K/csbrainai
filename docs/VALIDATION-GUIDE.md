# Manual Validation Guide

## Overview

This guide walks you through manually validating the CSBrainAI system after deployment. Follow these steps to ensure all components are working correctly.

---

## Prerequisites

- Development environment set up (see README.md)
- All environment variables configured
- Database migration applied
- Knowledge base ingested

---

## Step 1: Environment Validation

### Check Environment Variables

```bash
# Verify all required env vars are set
node -e "
const required = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE',
  'HASH_SALT',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN'
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing env vars:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required environment variables are set');
"
```

**Expected Output**: `✅ All required environment variables are set`

### Verify HASH_SALT Strength

```bash
echo $HASH_SALT | wc -c
```

**Expected Output**: ≥ 64 characters (32 bytes hex-encoded)

---

## Step 2: Database Validation

### Check pgvector Extension

```sql
-- Run in Supabase SQL Editor
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Expected Output**: One row with `extname = 'vector'`

### Verify Schema

```sql
-- Check table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'rag_docs';
```

**Expected Output**: One row with `table_name = 'rag_docs'`

### Check Indexes

```sql
-- List all indexes on rag_docs
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'rag_docs';
```

**Expected Output**:
- `rag_docs_pkey` (primary key)
- `idx_rag_docs_chunk_hash` (unique)
- `idx_rag_docs_embedding` (IVFFlat)
- `idx_rag_docs_source_url`

### Verify Row Level Security

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'rag_docs';
```

**Expected Output**: `rowsecurity = true`

---

## Step 3: Ingestion Validation

### Run Ingestion Script

```bash
npm run ingest
```

**Expected Output**:
```
🚀 Starting RAG ingestion...
📚 Found X knowledge file(s)

📄 Processing: sample-1.md
  ├─ Chunks: Y
  ├─ Progress: Y/Y
  └─ Completed: sample-1.md

...

✅ Ingestion complete!
📊 Summary:
  ├─ Total chunks: Z
  ├─ Processed: Z
  ├─ Skipped (duplicates): 0
  └─ Errors: 0
```

### Verify Data in Database

```sql
-- Count ingested documents
SELECT COUNT(*) FROM rag_docs;
```

**Expected Output**: Should match total chunks from ingestion summary

### Check Sample Document

```sql
-- View a sample document
SELECT
  id,
  source_url,
  LEFT(content, 100) as content_preview,
  embedding_model,
  embedding_date,
  array_length(embedding, 1) as embedding_dim
FROM rag_docs
LIMIT 1;
```

**Expected Output**:
- `embedding_model` = `text-embedding-3-small`
- `embedding_dim` = `1536`
- `content_preview` shows actual text

### Test Deduplication

```bash
# Run ingestion again
npm run ingest
```

**Expected Output**: `Skipped (duplicates): Z` (all previously ingested chunks)

---

## Step 4: Answer API Validation

### Start Development Server

```bash
npm run dev
```

**Expected Output**: `Ready on http://localhost:3000`

### Test API Endpoint (GET)

```bash
curl http://localhost:3000/api/answer
```

**Expected Output**: JSON with API documentation

### Test Answer Generation (POST)

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RAG?"}'
```

**Expected Output** (200):
```json
{
  "answer": "RAG (Retrieval Augmented Generation) is...",
  "citations": [
    {
      "source_url": "file://sample-1.md#chunk-0",
      "content": "...",
      "similarity": 0.87
    }
  ],
  "q_hash": "a3f2b9c1d4e5f6...",
  "q_len": 12,
  "tokensUsed": 456
}
```

**Validation Checklist**:
- [ ] `answer` is not empty
- [ ] `citations` array has 1-5 items
- [ ] `similarity` scores are between 0 and 1
- [ ] `q_hash` is a 64-character hex string
- [ ] `q_len` matches query length (12)

### Test Invalid Query

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": ""}'
```

**Expected Output** (400):
```json
{
  "error": "Invalid request. \"query\" field is required and must be a string."
}
```

### Test Query Too Long

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(printf 'a%.0s' {1..1001})\"}"
```

**Expected Output** (400):
```json
{
  "error": "Query too long. Maximum length is 1000 characters."
}
```

---

## Step 5: Rate Limiting Validation

### Test Normal Usage

```bash
# Send 5 requests (should all succeed)
for i in {1..5}; do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    -X POST http://localhost:3000/api/answer \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}'
done
```

**Expected Output**: All requests return `200`

### Test Rate Limit Enforcement

```bash
# Send 15 requests rapidly (should hit rate limit)
for i in {1..15}; do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    -X POST http://localhost:3000/api/answer \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' &
done
wait
```

**Expected Output**:
- First 10 requests: `200`
- Remaining requests: `429`

### Verify Rate Limit Headers

```bash
curl -i -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

**Expected Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: <timestamp>
```

---

## Step 6: Security Headers Validation

### Check Security Headers

```bash
curl -I http://localhost:3000
```

**Expected Headers**:
```
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Validate with Security Headers Tool

Visit: https://securityheaders.com/?q=http://localhost:3000

**Expected Grade**: A or A+

---

## Step 7: Sentry Validation

### Test Error Logging

```bash
# Trigger an intentional error (invalid OpenAI key simulation)
# Temporarily set invalid key in .env, restart server, then:
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

**Expected**:
- Returns 500 error
- Error appears in Sentry dashboard

### Verify PII Scrubbing

1. Check Sentry event for the error
2. Search event JSON for the word "test" (the query)
3. **Expected**: Query is NOT present; only `q_hash` and `q_len` appear

**Example Sentry Event** (scrubbed):
```json
{
  "extra": {
    "q_hash": "abc123...",
    "q_len": 4
  }
  // NO "query": "test"
}
```

---

## Step 8: Evaluation Suite Validation

### Run Evaluations

```bash
npm run evals
```

**Expected Output**:
```
🧪 Starting RAG evaluations...
📋 Loaded 20 test questions

[1/20] What is RAG?
  ├─ Quality: 85%
  ├─ Response time: 1823ms
  └─ Citations: 3

...

✅ Results written to: eval-results.json
✅ Summary written to: eval-summary.txt

RAG Evaluation Summary
======================
Results:
  Total Questions: 20
  Successful: 20
  Failed: 0

Performance:
  Avg Response Time: 1856ms
  Avg Quality Score: 78%
  Overall Quality: 78%

✅ Quality check passed
```

**Validation Checklist**:
- [ ] All 20 questions succeeded (Successful: 20, Failed: 0)
- [ ] Average quality score > 50%
- [ ] No severe regressions detected

### Inspect Evaluation Results

```bash
cat eval-results.json | jq '.results[0]'
```

**Expected Output**:
```json
{
  "id": "q1",
  "question": "What is RAG?",
  "answer": "...",
  "q_hash": "...",
  "q_len": 12,
  "citations_count": 3,
  "response_time_ms": 1823,
  "has_expected_keywords": true,
  "quality_score": 0.85
}
```

---

## Step 9: UI Validation

### Test Demo Interface

1. Open http://localhost:3000 in browser
2. Enter question: "What is RAG?"
3. Click "Ask"

**Expected**:
- Loading state shows ("🤔 Thinking...")
- Answer appears within 2-3 seconds
- Citations are displayed with similarity scores
- Metadata shows query hash and length

### Test Error States

1. Submit empty query → Should show validation error
2. Submit very long query (>1000 chars) → Should show "Query too long" error
3. Rapidly submit 15 queries → Should show "Rate limit exceeded" error

---

## Step 10: Nightly Evals Workflow

### Validate GitHub Actions Workflow

```bash
# Check workflow syntax
cat .github/workflows/nightly-evals.yml
```

**Expected**: Valid YAML with:
- Scheduled trigger (cron: '0 2 * * *')
- Build, start server, run evals
- Upload artifacts
- Quality threshold check

### Manual Workflow Run

1. Go to GitHub Actions tab
2. Select "Nightly RAG Evaluations"
3. Click "Run workflow"
4. Wait for completion (~5 minutes)

**Expected**:
- Workflow completes successfully
- Artifact `eval-results-<run-number>` is uploaded
- Download artifact and verify `eval-results.json` and `eval-summary.txt`

---

## Troubleshooting

### Ingestion Fails

**Problem**: `OpenAI API rate limit exceeded`

**Solution**: Increase delay in `scripts/ingest.ts`:
```typescript
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
```

---

### Vector Search Returns No Results

**Problem**: `matchedDocs.length === 0`

**Solution**:
1. Check if data is ingested: `SELECT COUNT(*) FROM rag_docs;`
2. Verify similarity threshold (try lowering to 0.3)
3. Check embedding dimensions match (1536)

---

### Rate Limiter Not Working

**Problem**: Can make unlimited requests

**Solution**:
1. Check middleware is applied: Look for `middleware.ts` in logs
2. Verify IP extraction: Add debug logs to `getIdentifier()`
3. Check Upstash config or fallback logic

---

### Sentry Not Receiving Events

**Problem**: No events in Sentry dashboard

**Solution**:
1. Verify `SENTRY_DSN` is correct
2. Check console for Sentry init errors
3. Manually trigger error: `Sentry.captureException(new Error('test'))`

---

## Validation Checklist

Use this checklist to ensure all components are validated:

- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] pgvector extension enabled
- [ ] Indexes created (IVFFlat, chunk_hash, etc.)
- [ ] RLS policies enabled
- [ ] Ingestion successful
- [ ] Deduplication working
- [ ] Answer API returns valid responses
- [ ] Invalid queries rejected (400)
- [ ] Rate limiting enforced (429 after 10 req/min)
- [ ] Security headers present
- [ ] Sentry receiving events
- [ ] PII scrubbing verified (no raw queries in Sentry)
- [ ] Evaluations passing (>50% quality)
- [ ] UI functional (questions → answers)
- [ ] GitHub Actions workflow valid

---

## Success Criteria

✅ **System is validated when**:
- All checklist items are checked
- Ingestion processes knowledge without errors
- Answer API returns relevant answers with citations
- Rate limiting blocks excessive requests
- Sentry logs errors without PII
- Evaluations pass with >50% quality score
- UI provides good user experience

---

## Next Steps

After validation:
1. Review [GO-LIVE-GATE.md](./GO-LIVE-GATE.md) for production readiness
2. Set up monitoring dashboards
3. Configure alerts in Sentry
4. Schedule nightly evaluations
5. Deploy to production

---

**Happy validating! 🚀**
