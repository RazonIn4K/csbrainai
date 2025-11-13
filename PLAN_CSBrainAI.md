# CSBrainAI: RAG API Validation & UI Enhancement Plan

**Date:** 2025-11-13
**Branch:** `claude/rag-api-validation-ui-01PH38r3SPmX3CYXPNgC8V4a`

---

## A. API vs Spec

### Current Request Shape (route.ts)
```typescript
{
  query: string  // Required, max 1000 chars
}
```

**Validation in place:**
- ✅ `query` field presence check (line 43)
- ✅ Type check (string) (line 43)
- ✅ Maximum length check (1000 chars) (line 50)

**Missing validation:**
- ❌ Minimum length check (query could be empty string after trim)
- ❌ No rate limiting enforcement in route handler

---

### Current Response Shape (route.ts)

**Success (200):**
```typescript
{
  answer: string,
  citations: Citation[],
  q_hash: string,
  q_len: number,
  tokensUsed?: number  // Optional
}

interface Citation {
  source_url: string,
  content: string,      // Truncated to ~200 chars
  similarity: number    // 0-1
}
```

**Error responses:**
- **400 (line 45):** `{ error: string }` - INCONSISTENT, missing `message` field
- **400 (line 52):** `{ error: string }` - INCONSISTENT, missing `message` field
- **500 (line 137):** `{ error: string, message: string }` - CONSISTENT with docs

---

### Mismatches vs docs/ANSWER-FLOW.md

#### 1. **Error Response Format (400 errors)**
**Expected per docs (line 106-111):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

**Actual in route.ts:**
```typescript
// Line 45-46: Missing structured format
{ error: 'Invalid request. "query" field is required and must be a string.' }

// Line 52-53: Missing structured format
{ error: 'Query too long. Maximum length is 1000 characters.' }
```

**Fix needed:** Add consistent error shape with `type` field for programmatic handling:
```typescript
{
  error: {
    type: "validation_error",
    message: string,
    details?: any
  }
}
```

#### 2. **Rate Limiting Missing**
**Expected per docs:**
- Rate limiting enforced via `middleware.ts` (line 287)
- 429 response with `Retry-After` header

**Actual in route.ts:**
- ❌ **NO rate limiting call in the route handler**
- `lib/rate-limiter.ts` exists and is well-implemented but NEVER called from `/api/answer`

**Fix needed:**
- Import and call `rateLimit(request)` at start of POST handler
- Return 429 with structured error on limit exceeded
- Add `retryAfterSeconds` to error response

#### 3. **No Middleware Integration**
**Expected:** Rate limiting applied via `middleware.ts`
**Actual:** No middleware file found in the codebase (only referenced in docs)

**Fix needed:**
- Either add middleware.ts OR call rate limiter directly in route.ts
- For simplicity and explicit control: call it directly in route.ts

---

### Edge Cases Not Handled

1. **Empty query after trim:** `"   "` would pass length checks but is meaningless
2. **Rate limit unavailability:** `RateLimitUnavailableError` in production should return 503, not crash
3. **Missing HASH_SALT:** Would throw unhandled error (should be caught and return 500)

---

## B. Validation & Rate-Limiting

### Current Rate Limiter (`lib/rate-limiter.ts`)

**Strategy:**
- **Primary:** Upstash Redis with sliding window (10 req/min)
- **Fallback:** In-memory token bucket (development only)
- **Production:** Fails closed if Redis unavailable (`RateLimitUnavailableError`)

**Identifier extraction:**
- IP from `x-forwarded-for`, `x-real-ip`, or `request.ip`
- Fallback: `"unknown"`

**Return format:**
```typescript
{
  success: boolean,
  limit: number,        // 10
  remaining: number,    // 0-10
  reset?: number        // Timestamp in ms
}
```

**Error handling:**
- Throws `RateLimitUnavailableError` in production if Redis is down
- Logs warning and uses fallback in development

---

### Current Route Validation Status

**What `route.ts` currently does:**
- ✅ Validates `query` field existence and type
- ✅ Validates max length (1000 chars)
- ✅ Hashes query for privacy-safe logging
- ✅ Logs to Sentry with PII scrubbing

**What `route.ts` is missing:**
- ❌ Rate limiting enforcement (critical for public use!)
- ❌ Minimum length validation
- ❌ Structured error responses for programmatic handling
- ❌ 429 error handling
- ❌ 503 error for rate limiter unavailability

---

### Proposed Validation Flow

```typescript
1. Parse request body
2. **[NEW]** Call rateLimit(request)
   - If !success → return 429 with retry-after
3. Validate query:
   - Required, string type
   - Min length: 3 chars (after trim)
   - Max length: 1000 chars
4. Hash query for logging
5. Generate embedding
6. Search & generate answer
7. Return response
```

**Error format standardization:**
```typescript
// 400 - Validation Error
{
  error: {
    type: "validation_error",
    message: "Query is required and must be at least 3 characters",
    field?: "query"
  }
}

// 429 - Rate Limited
{
  error: {
    type: "rate_limited",
    message: "Too many requests. Please try again later."
  },
  retryAfterSeconds: number
}

// 500 - Internal Error
{
  error: {
    type: "internal_error",
    message: "Failed to generate answer. Please try again later."
  }
}

// 503 - Service Unavailable
{
  error: {
    type: "service_unavailable",
    message: "Rate limiting service temporarily unavailable."
  }
}
```

---

## C. UI / DX

### Current AnswerDemo.tsx Experience

**What's clear:**
- ✅ Simple, functional form
- ✅ Character counter (1000 limit)
- ✅ Loading state ("🤔 Thinking...")
- ✅ Citations displayed with similarity scores
- ✅ Metadata shown (hash, length, tokens)

**What's confusing/missing:**
- ❌ **No context:** User lands on page with zero explanation of what csbrainai is
- ❌ **No guidance:** No example questions, user must guess what to ask
- ❌ **Generic errors:** Error display just shows `error.message` without context
- ❌ **No rate limit handling:** 429 errors shown as generic failure, no retry guidance
- ❌ **No validation feedback:** Client-side validation could catch issues before API call
- ❌ **Not self-explanatory:** Assumes user knows what RAG, citations, embeddings are

**Current error handling (line 42-50):**
```typescript
if (!res.ok) {
  const errorData = await res.json();
  throw new Error(errorData.error || 'Failed to get answer');
}
```
- Doesn't parse structured error format
- Doesn't handle 429 differently
- Doesn't show retry-after information

---

### Proposed UI Improvements

#### 1. **Intro Section** (before form)
```
🧠 CSBrainAI

An AI assistant specialized in computer science and cybersecurity topics,
powered by a privacy-first RAG (Retrieval Augmented Generation) pipeline.
Ask technical questions and get answers backed by our curated knowledge base.

[What is RAG?] [Example Questions ▼]
```

#### 2. **Example Questions** (clickable)
```typescript
const EXAMPLE_QUESTIONS = [
  "What is RAG and how does it work?",
  "Explain the difference between symmetric and asymmetric encryption",
  "What are common SQL injection prevention techniques?"
];
```
- Click to auto-fill input
- Shows users what kind of questions work well

#### 3. **Enhanced Error Handling**
```typescript
// Parse structured error response
interface ErrorResponse {
  error: {
    type: string;
    message: string;
    field?: string;
  };
  retryAfterSeconds?: number;
}

// Display user-friendly messages:
- validation_error → "⚠️ {message}" (yellow, inline)
- rate_limited → "⏱️ Too many requests. Retry in {N} seconds" (orange banner)
- internal_error → "❌ Something went wrong. Try again?" (red, with retry button)
- service_unavailable → "🔧 Service temporarily down" (gray)
```

#### 4. **Client-Side Validation** (before API call)
```typescript
const trimmedQuery = query.trim();
if (trimmedQuery.length < 3) {
  setError("Please enter at least 3 characters");
  return;
}
if (trimmedQuery.length > 1000) {
  setError("Query too long (max 1000 characters)");
  return;
}
```

#### 5. **Rate Limit UX**
- Parse `retryAfterSeconds` from 429 response
- Show countdown timer
- Auto-enable submit button after cooldown
- Visual indicator: "You can ask again in 47 seconds..."

---

## Implementation Plan

### Phase 1: Type Safety & Schema (lib/types.ts or lib/schema.ts)

**Option A: TypeScript interfaces** (simpler, no runtime validation)
```typescript
// lib/types.ts
export interface AnswerRequestBody {
  query: string;
}

export interface ErrorResponse {
  error: {
    type: "validation_error" | "rate_limited" | "internal_error" | "service_unavailable";
    message: string;
    field?: string;
  };
  retryAfterSeconds?: number;
}
```

**Option B: Zod schema** (runtime validation + type inference)
```typescript
// lib/schema.ts
import { z } from 'zod';

export const AnswerRequestSchema = z.object({
  query: z.string()
    .min(3, "Query must be at least 3 characters")
    .max(1000, "Query must be at most 1000 characters")
    .transform(s => s.trim())
});

export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
```

**Recommendation:** Use Zod for automatic validation + type safety

---

### Phase 2: Update app/api/answer/route.ts

**Changes needed:**
1. Import Zod schema and rate limiter
2. Add rate limiting at top of POST handler
3. Use Zod to validate request body
4. Return structured error responses
5. Handle `RateLimitUnavailableError` → 503

**Pseudocode:**
```typescript
export async function POST(request: NextRequest) {
  // 1. Rate limiting
  try {
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset! - Date.now()) / 1000);
      return NextResponse.json({
        error: {
          type: "rate_limited",
          message: "Too many requests. Please try again later."
        },
        retryAfterSeconds: retryAfter
      }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) }
      });
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      // Production: Redis is down, fail closed
      Sentry.captureException(error);
      return NextResponse.json({
        error: {
          type: "service_unavailable",
          message: "Service temporarily unavailable. Please try again later."
        }
      }, { status: 503 });
    }
    throw error; // Re-throw unexpected errors
  }

  // 2. Validation with Zod
  const parseResult = AnswerRequestSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json({
      error: {
        type: "validation_error",
        message: parseResult.error.errors[0].message,
        details: parseResult.error.errors
      }
    }, { status: 400 });
  }

  const { query } = parseResult.data;

  // 3. Continue with existing logic...
}
```

---

### Phase 3: Update components/AnswerDemo.tsx

**Changes:**
1. Add intro section with explanation
2. Add example questions array with click handlers
3. Enhance error parsing and display
4. Add client-side validation
5. Handle 429 with retry countdown
6. Add "Try Again" button for 500 errors

**New state:**
```typescript
const [retryAfter, setRetryAfter] = useState<number | null>(null);
const [errorType, setErrorType] = useState<string | null>(null);
```

**Enhanced fetch:**
```typescript
try {
  const res = await fetch('/api/answer', { ... });

  if (res.status === 429) {
    const data = await res.json();
    setErrorType('rate_limited');
    setRetryAfter(data.retryAfterSeconds || 60);
    // Start countdown timer
    return;
  }

  if (!res.ok) {
    const data = await res.json();
    setErrorType(data.error?.type || 'unknown');
    setError(data.error?.message || 'An error occurred');
    return;
  }

  // Success...
}
```

---

### Phase 4: Documentation Alignment

**Files to update:**
1. `docs/ANSWER-FLOW.md` (lines 104-118)
   - Update error response format to match new structured format
   - Add 503 status code for service unavailable
   - Document new validation rules (min 3 chars)

2. `docs/VALIDATION-GUIDE.md` (lines 226-237, 242-251)
   - Update test expectations for new error format
   - Add test case for minimum length validation
   - Add test case for rate limiting

---

## Files Changed

### New Files:
- `PLAN_CSBrainAI.md` (this document)
- `lib/schema.ts` (Zod schemas for validation)

### Modified Files:
- `app/api/answer/route.ts` (add rate limiting, structured errors, Zod validation)
- `components/AnswerDemo.tsx` (intro, examples, enhanced error handling)
- `docs/ANSWER-FLOW.md` (align error formats, add 503 status)
- `docs/VALIDATION-GUIDE.md` (update test expectations)
- `lib/types.ts` (if using TypeScript approach instead of Zod)

---

## TODOs / Future Enhancements

### Deferred (not in scope for this session):
- [ ] **Streaming responses:** Stream LLM output for better perceived latency
- [ ] **Response caching:** Cache identical queries (with privacy considerations)
- [ ] **Embedding cache:** Cache embeddings for common queries
- [ ] **More comprehensive evals:** Add adversarial/edge-case questions to test-questions.jsonl
- [ ] **Middleware approach:** Move rate limiting to middleware.ts for centralized enforcement
- [ ] **Advanced validation:** Sanitize input for injection attempts (though LLM should handle this)
- [ ] **Client-side rate limit tracking:** Store last request time in localStorage to prevent unnecessary 429s
- [ ] **Analytics:** Track most common questions, avg response time, citation quality
- [ ] **A11y improvements:** ARIA labels, keyboard navigation, screen reader support
- [ ] **Mobile responsive:** Optimize layout for mobile devices
- [ ] **Dark mode:** Add theme toggle
- [ ] **Retry logic:** Automatic exponential backoff for transient failures

### Monitoring Considerations:
- [ ] Set up Sentry alerts for `RateLimitUnavailableError` (critical production issue)
- [ ] Monitor 429 rate to detect abuse patterns
- [ ] Track validation error distribution to improve UX
- [ ] Set up uptime monitoring for Upstash Redis

---

## Security Checklist

Before deployment:
- [x] Query hashing implemented (PII-safe logging)
- [x] Sentry PII scrubbing configured
- [x] Rate limiting implemented (10 req/min)
- [ ] Rate limiting enforced in route handler ⚠️ **TO BE FIXED**
- [x] Service role key only used server-side
- [x] Input validation (max length)
- [ ] Input validation (min length) ⚠️ **TO BE ADDED**
- [x] Error messages don't leak internal details
- [ ] Structured errors for client ⚠️ **TO BE IMPROVED**
- [x] HASH_SALT strength validated (≥64 chars)
- [ ] Production fails closed without Redis ⚠️ **TO BE TESTED**

---

## Success Criteria

This implementation is complete when:
1. ✅ `/api/answer` enforces rate limiting (10 req/min)
2. ✅ All error responses follow consistent structured format
3. ✅ Validation catches empty/too-short queries
4. ✅ 429 errors include `retryAfterSeconds`
5. ✅ UI shows intro text explaining csbrainai
6. ✅ UI provides 3 clickable example questions
7. ✅ UI handles rate limit errors with countdown
8. ✅ Documentation matches implementation
9. ✅ Tests pass (`npm test`)
10. ✅ Type checks pass (`tsc --noEmit`)
