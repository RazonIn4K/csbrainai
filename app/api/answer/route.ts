import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { generateEmbedding, generateAnswer } from '@/lib/openai';
import { searchDocuments } from '@/lib/supabase';
import { hashQuery } from '@/lib/crypto-utils';
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limiter';
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

    // Step 3: Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Step 4: Vector search for similar documents
    const matchedDocs = await searchDocuments(queryEmbedding, {
      matchThreshold: 0.5, // Minimum similarity score
      matchCount: 5, // Top 5 results
    });

    if (matchedDocs.length === 0) {
      return NextResponse.json<AnswerResponse>({
        answer: "I don't have enough information in my knowledge base to answer that question.",
        citations: [],
        q_hash: qHash,
        q_len: qLen,
      });
    }

    // Step 5: Build context from matched documents
    const context = matchedDocs.map((doc) => doc.content);

    // Step 6: Generate answer using LLM with context
    const { answer, tokensUsed } = await generateAnswer(query, context);

    // Step 7: Prepare citations
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
      },
    });

    const response: AnswerResponse = {
      answer,
      citations,
      q_hash: qHash,
      q_len: qLen,
      tokensUsed,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in /api/answer:', error);

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
