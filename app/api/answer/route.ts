import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { generateEmbedding, generateAnswer, CHAT_MODEL } from '@/lib/openai';
import { searchDocuments } from '@/lib/supabase';
import { hashQuery } from '@/lib/crypto-utils';
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limiter';
import { createMetricsTracker, type RagMetricsTracker } from '@/lib/metrics';
import { evaluatePromptForInjection, shouldBlockPrompt } from '@/lib/prompt-guard';
import { estimateLlmCost } from '@/lib/cost-estimator';
import {
  AnswerRequestSchema,
  type AnswerResponse,
  type Citation,
  createValidationError,
  createRateLimitError,
  createInternalError,
  createServiceUnavailableError,
} from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/answer
 *
 * RAG-powered question answering endpoint.
 * Privacy-first: Only stores HMAC hash and length of queries, never raw content.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let metrics: RagMetricsTracker | null = null;

  try {
    // Step 0: Rate limiting (critical for public endpoints)
    try {
      const rateLimitResult = await rateLimit(request);

      if (!rateLimitResult.success) {
        // Calculate retry-after in seconds
        const retryAfterMs = rateLimitResult.reset ? rateLimitResult.reset - Date.now() : 60000;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        Sentry.addBreadcrumb({
          category: 'rate-limit',
          message: 'Rate limit exceeded',
          level: 'warning',
          data: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            retryAfter: retryAfterSeconds,
          },
        });

        return NextResponse.json(createRateLimitError(retryAfterSeconds), {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset || Date.now() + retryAfterMs),
          },
        });
      }
    } catch (error) {
      // Handle rate limiter unavailability
      if (error instanceof RateLimitUnavailableError) {
        console.error('Rate limiter unavailable (production fail-closed):', error);
        Sentry.captureException(error, {
          tags: {
            endpoint: '/api/answer',
            critical: 'true',
          },
        });

        return NextResponse.json(createServiceUnavailableError(), { status: 503 });
      }
      // Re-throw unexpected errors
      throw error;
    }

    // Step 1: Parse and validate request body with Zod
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(createValidationError('Invalid JSON in request body'), {
        status: 400,
      });
    }

    const parseResult = AnswerRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        createValidationError(firstError.message, firstError.path[0] as string, parseResult.error.errors),
        { status: 400 }
      );
    }

    const { query } = parseResult.data;

    // Step 2: Hash query for privacy-safe logging (NEVER log the raw query)
    const { hash: qHash, length: qLen } = hashQuery(query);

    const tracker = createMetricsTracker({ queryHash: qHash });
    metrics = tracker;

    // Log hashed query to Sentry (safe for PII compliance)
    Sentry.addBreadcrumb({
      category: 'rag.query',
      message: 'Query received',
      level: 'info',
      data: {
        q_hash: qHash,
        q_len: qLen,
      },
    });

    // Step 3: Prompt-injection guard hook
    const promptVerdict = evaluatePromptForInjection(query);
    if (promptVerdict.flagged && shouldBlockPrompt(promptVerdict)) {
      tracker.markFailure('prompt_guard_blocked');
      tracker.finalize();
      return NextResponse.json(
        createValidationError('Potential prompt-injection detected. Please rephrase your question.'),
        { status: 400 }
      );
    }

    // Step 4: Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Step 5: Vector search for similar documents
    const searchOptions = {
      matchThreshold: 0.5, // Minimum similarity score
      matchCount: 5, // Top 5 results
    } as const;

    const matchedDocs = await tracker.measureVectorSearch(() =>
      searchDocuments(queryEmbedding, searchOptions)
    );

    tracker.setChunkCount(matchedDocs.length);

    if (matchedDocs.length === 0) {
      tracker.markFailure('no_matches');
      tracker.finalize();
      return NextResponse.json<AnswerResponse>({
        answer: "I don't have enough information in my knowledge base to answer that question.",
        citations: [],
        q_hash: qHash,
        q_len: qLen,
      });
    }

    // Step 6: Build context from matched documents
    const context = matchedDocs.map((doc) => doc.content);

    // Step 7: Generate answer using LLM with context
    const { answer, tokensUsed, usage } = await generateAnswer(query, context);
    if (!answer) {
      throw new Error('LLM failed to generate an answer');
    }
    tracker.setTokensUsed(tokensUsed ?? 0);

    const costEstimate = await estimateLlmCost({
      model: CHAT_MODEL,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens ?? tokensUsed,
    });
    tracker.setCostUsd(costEstimate.costUsd);

    // Step 8: Prepare citations
    const citations: Citation[] = matchedDocs.map((doc) => ({
      source_url: doc.source_url,
      content: doc.content.substring(0, 200) + '...', // Truncate for response
      similarity: doc.similarity,
    }));

    // Log successful completion (privacy-safe metadata only)
    Sentry.addBreadcrumb({
      category: 'rag.answer',
      message: 'Answer generated',
      level: 'info',
      data: {
        q_hash: qHash,
        q_len: qLen,
        citations_count: citations.length,
        tokens_used: tokensUsed,
        duration_ms: Date.now() - startTime,
        cost_usd: costEstimate.costUsd ?? null,
      },
    });

    const response: AnswerResponse = {
      answer,
      citations,
      q_hash: qHash,
      q_len: qLen,
      tokensUsed,
    };

    tracker.markSuccess();
    tracker.finalize();

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in /api/answer:', error);

    if (metrics) {
      metrics.markFailure(error?.message ?? 'unhandled_error');
      metrics.finalize();
    }

    // Log error to Sentry (PII scrubbing handled by beforeSend hook)
    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/answer',
      },
      extra: {
        duration_ms: Date.now() - startTime,
      },
    });

    return NextResponse.json(createInternalError(), { status: 500 });
  }
}

/**
 * GET /api/answer
 * Return API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/answer',
    method: 'POST',
    description: 'RAG-powered question answering with privacy-first logging',
    rateLimit: {
      requests: 10,
      window: '1 minute',
      identifier: 'IP address',
    },
    request: {
      query: 'string (required, min 3 chars, max 1000 chars)',
    },
    response: {
      success: {
        answer: 'string',
        citations: 'Citation[]',
        q_hash: 'string (HMAC-SHA256 hash of query)',
        q_len: 'number (length of query)',
        tokensUsed: 'number (optional)',
      },
      error: {
        error: {
          type: 'validation_error | rate_limited | internal_error | service_unavailable',
          message: 'string',
          field: 'string (optional)',
          details: 'any (optional)',
        },
        retryAfterSeconds: 'number (only for rate_limited)',
      },
    },
    statusCodes: {
      200: 'Success',
      400: 'Validation error',
      429: 'Rate limit exceeded',
      500: 'Internal server error',
      503: 'Service unavailable (rate limiter down)',
    },
    privacy: 'Only query hash and length are logged. Raw queries are never stored.',
  });
}
