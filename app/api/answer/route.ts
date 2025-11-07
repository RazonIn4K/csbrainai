import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { generateEmbedding, generateAnswer } from '@/lib/openai';
import { searchDocuments } from '@/lib/supabase';
import { hashQuery } from '@/lib/crypto-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnswerRequest {
  query: string;
}

interface Citation {
  source_url: string;
  content: string;
  similarity: number;
}

interface AnswerResponse {
  answer: string;
  citations: Citation[];
  q_hash: string;
  q_len: number;
  tokensUsed?: number;
}

/**
 * POST /api/answer
 *
 * RAG-powered question answering endpoint.
 * Privacy-first: Only stores HMAC hash and length of queries, never raw content.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: AnswerRequest = await request.json();
    const { query } = body;

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request. "query" field is required and must be a string.' },
        { status: 400 }
      );
    }

    if (query.length > 1000) {
      return NextResponse.json(
        { error: 'Query too long. Maximum length is 1000 characters.' },
        { status: 400 }
      );
    }

    // Hash query for privacy-safe logging (NEVER log the raw query)
    const { hash: qHash, length: qLen } = hashQuery(query);

    // Log hashed query to Sentry (safe for PII compliance)
    Sentry.addBreadcrumb({
      category: 'rag',
      message: 'Query received',
      level: 'info',
      data: {
        q_hash: qHash,
        q_len: qLen,
        timestamp: new Date().toISOString(),
      },
    });

    // Step 1: Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Step 2: Vector search for similar documents
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

    // Step 3: Build context from matched documents
    const context = matchedDocs.map((doc) => doc.content);

    // Step 4: Generate answer using LLM with context
    const { answer, tokensUsed } = await generateAnswer(query, context);

    // Step 5: Prepare citations
    const citations: Citation[] = matchedDocs.map((doc) => ({
      source_url: doc.source_url,
      content: doc.content.substring(0, 200) + '...', // Truncate for response
      similarity: doc.similarity,
    }));

    // Log successful completion (with privacy-safe metadata)
    Sentry.addBreadcrumb({
      category: 'rag',
      message: 'Answer generated',
      level: 'info',
      data: {
        q_hash: qHash,
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

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to generate answer. Please try again later.',
      },
      { status: 500 }
    );
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
    request: {
      query: 'string (required, max 1000 characters)',
    },
    response: {
      answer: 'string',
      citations: 'Citation[]',
      q_hash: 'string (HMAC-SHA256 hash of query)',
      q_len: 'number (length of query)',
      tokensUsed: 'number (optional)',
    },
    privacy: 'Only query hash and length are logged. Raw queries are never stored.',
  });
}
