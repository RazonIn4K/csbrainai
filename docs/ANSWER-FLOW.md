# Answer API Flow Documentation

## Overview

The `/api/answer` endpoint provides RAG-powered question answering with privacy-first logging and comprehensive security measures.

## Request Flow

```
┌──────────────┐
│ User Query   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Middleware       │
│ - Rate Limiting  │
│ - Security Headers│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Hash Query       │
│ (HMAC-SHA256)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Generate         │
│ Embedding        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Vector Search    │
│ (Top 5)          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Build Context    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ LLM Generation   │
│ (gpt-4o-mini)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Return Answer    │
│ + Citations      │
└──────────────────┘
```

## API Specification

### Endpoint

`POST /api/answer`

### Request

```json
{
  "query": "What is RAG?"
}
```

**Constraints**:
- `query` must be a non-empty string
- Minimum length: 3 characters (after trim)
- Maximum length: 1000 characters
- Required field

### Response (Success)

```json
{
  "answer": "RAG (Retrieval Augmented Generation) is...",
  "citations": [
    {
      "source_url": "file://sample-1.md#chunk-0",
      "content": "RAG (Retrieval Augmented Generation) is an AI architecture...",
      "similarity": 0.87
    }
  ],
  "q_hash": "a3f2b9c1d4e5f6...",
  "q_len": 12,
  "tokensUsed": 456
}
```

**Fields**:
- `answer` (string): Generated answer based on context
- `citations` (array): Sources used to generate answer
  - `source_url` (string): Origin of the chunk
  - `content` (string): Truncated content (~200 chars)
  - `similarity` (number): Cosine similarity score (0-1)
- `q_hash` (string): HMAC-SHA256 hash of query
- `q_len` (number): Length of original query
- `tokensUsed` (number, optional): Tokens consumed by LLM

### Response (Error)

All error responses follow a structured format for programmatic handling:

**Validation Error (400)**:
```json
{
  "error": {
    "type": "validation_error",
    "message": "Query must be at least 3 characters",
    "field": "query",
    "details": [...]
  }
}
```

**Rate Limit Error (429)**:
```json
{
  "error": {
    "type": "rate_limited",
    "message": "Too many requests. Please try again later."
  },
  "retryAfterSeconds": 45
}
```

**Internal Error (500)**:
```json
{
  "error": {
    "type": "internal_error",
    "message": "Failed to generate answer. Please try again later."
  }
}
```

**Service Unavailable (503)**:
```json
{
  "error": {
    "type": "service_unavailable",
    "message": "Service temporarily unavailable. Please try again later."
  }
}
```

**HTTP Status Codes**:
- `200`: Success
- `400`: Invalid request (missing/invalid query, validation errors)
- `429`: Rate limit exceeded (10 req/min/IP)
- `500`: Internal server error
- `503`: Service unavailable (rate limiter unavailable)

## Implementation Details

### 1. Query Hashing (Privacy Layer)

```typescript
const { hash: qHash, length: qLen } = hashQuery(query);
```

**Purpose**:
- Enable logging without storing PII
- Allow duplicate detection
- Support debugging with privacy

**Algorithm**:
```
q_hash = HMAC-SHA256(query, HASH_SALT)
q_len = length(query)
```

**Logged to Sentry**:
```javascript
Sentry.addBreadcrumb({
  category: 'rag',
  data: {
    q_hash: qHash,
    q_len: qLen,
    timestamp: new Date().toISOString()
  }
});
```

### 2. Embedding Generation

```typescript
const queryEmbedding = await generateEmbedding(query);
```

**Model**: `text-embedding-3-small`
- **Input**: Query string (up to 1000 chars)
- **Output**: 1536-dimensional vector
- **Latency**: ~300-500ms

### 3. Vector Search

```typescript
const matchedDocs = await searchDocuments(queryEmbedding, {
  matchThreshold: 0.5,
  matchCount: 5
});
```

**Parameters**:
- `matchThreshold`: 0.5 (minimum 50% similarity)
- `matchCount`: 5 (top 5 results)

**SQL Function**:
```sql
SELECT * FROM match_documents(
  query_embedding,
  0.5,  -- threshold
  5     -- count
);
```

**Similarity Metric**: Cosine distance
```
similarity = 1 - cosine_distance(query_embedding, doc_embedding)
```

### 4. Context Building

```typescript
const context = matchedDocs.map(doc => doc.content);
```

**Format**:
```
[1] First chunk content...

[2] Second chunk content...

[3] Third chunk content...
```

**Max Context Size**:
- 5 chunks × ~2000 chars = ~10,000 chars
- Approximately 2,500 tokens
- Well within GPT-4o-mini's 128k context window

### 5. LLM Generation

```typescript
const { answer, tokensUsed } = await generateAnswer(query, context);
```

**System Prompt**:
```
You are a helpful AI assistant. Answer questions based on the provided context.
If the answer cannot be found in the context, say "I don't have enough information to answer that question."
Be concise and accurate.
```

**Model**: `gpt-4o-mini`
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 500
- **Latency**: ~1-2 seconds

## Performance Characteristics

### Latency Breakdown

Typical request (warm cache):
```
Rate Limiting:     ~5ms
Query Hashing:     ~1ms
Embedding:         ~400ms
Vector Search:     ~50ms
LLM Generation:    ~1500ms
Response Prep:     ~5ms
──────────────────────────
Total:             ~1960ms
```

### Optimization Opportunities

1. **Embedding Cache**: Cache embeddings for common queries
2. **Parallel Embedding**: Pre-compute embeddings for FAQ
3. **Streaming Response**: Stream LLM output for perceived speed
4. **CDN Caching**: Cache responses for identical queries (with privacy considerations)

## Error Handling

### No Matching Documents

```typescript
if (matchedDocs.length === 0) {
  return {
    answer: "I don't have enough information in my knowledge base to answer that question.",
    citations: [],
    q_hash: qHash,
    q_len: qLen
  };
}
```

### OpenAI API Errors

All OpenAI errors are caught and logged to Sentry:
```typescript
Sentry.captureException(error, {
  tags: { endpoint: '/api/answer' },
  extra: { duration_ms: Date.now() - startTime }
});
```

User receives generic error:
```json
{
  "error": "Internal server error",
  "message": "Failed to generate answer. Please try again later."
}
```

## Security Measures

### 1. Rate Limiting

Applied in `middleware.ts`:
- **Limit**: 10 requests/min/IP
- **Strategy**: Upstash Redis (primary). Token Bucket fallback **dev-only**; production fails closed if Redis is misconfigured.
- **Response**: HTTP 429 with `Retry-After` header

### 2. Input Validation

**Validation using Zod schema**:
```typescript
const AnswerRequestSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .transform(s => s.trim())
    .refine(s => s.length >= 3, {
      message: 'Query must be at least 3 characters'
    })
    .refine(s => s.length <= 1000, {
      message: 'Query must be at most 1000 characters'
    })
});

const parseResult = AnswerRequestSchema.safeParse(body);
if (!parseResult.success) {
  return NextResponse.json(
    createValidationError(firstError.message, firstError.path[0]),
    { status: 400 }
  );
}
```

**Validation rules**:
- Required string field
- Minimum 3 characters (after trim)
- Maximum 1000 characters
- Invalid JSON returns 400 with clear error message

### 3. PII Scrubbing

- Raw query **NEVER** logged
- Only `{q_hash, q_len}` sent to Sentry
- All Sentry events scrubbed by `beforeSend` hook

### 4. Security Headers

Applied via middleware:
- CSP: Prevents XSS
- X-Frame-Options: Prevents clickjacking
- HSTS: Enforces HTTPS

## Testing

### Manual Test

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RAG?"}'
```

### Evaluation Tests

Run automated evals:
```bash
npm run evals
```

Tests 20 questions and validates:
- Response quality
- Citation presence
- Response time
- Error handling

## Monitoring

### Sentry Metrics

Track in Sentry dashboard:
- Request duration (p50, p95, p99)
- Error rate
- Query hash distribution (privacy-safe)

### Custom Breadcrumbs

```javascript
// Query received
Sentry.addBreadcrumb({
  category: 'rag',
  message: 'Query received',
  data: { q_hash, q_len, timestamp }
});

// Answer generated
Sentry.addBreadcrumb({
  category: 'rag',
  message: 'Answer generated',
  data: { q_hash, citations_count, tokens_used, duration_ms }
});
```

## Future Enhancements

1. **Hybrid Search**: Combine vector + keyword search
2. **Re-ranking**: Use cross-encoder for better citation ordering
3. **Conversation Memory**: Support follow-up questions
4. **Source Filtering**: Allow users to filter by source type
5. **Streaming**: Stream LLM responses for better UX
