import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { generateChatCompletion, buildRAGPrompt, DEFAULT_CHAT_MODEL } from '@/lib/openai/chat';
import { searchSimilarDocuments } from '@/lib/supabase/vector-search';
import { createQueryMetadata } from '@/lib/utils/hash';
import { logQueryMetrics } from '@/lib/sentry/server';

/**
 * POST /api/answer
 *
 * RAG endpoint: Embeds query, searches vector DB, generates answer
 * Privacy: NEVER logs raw query, only {hash, length}
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse and validate request
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Query is required and must be a string',
        },
        { status: 400 }
      );
    }

    if (query.length < 1 || query.length > 1000) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Query must be between 1 and 1000 characters',
        },
        { status: 400 }
      );
    }

    // 2. Create query metadata (PII-safe)
    const queryMetadata = createQueryMetadata(query);

    // 3. Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(query);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      Sentry.captureException(error, {
        tags: { step: 'embedding' },
        extra: { q_len: queryMetadata.q_len },
      });
      return NextResponse.json(
        {
          error: 'Service error',
          message: 'Failed to process query',
        },
        { status: 500 }
      );
    }

    // 4. Search for similar documents
    let searchResults;
    try {
      searchResults = await searchSimilarDocuments(
        queryEmbedding,
        5, // top-k
        0.5 // min similarity threshold
      );
    } catch (error) {
      console.error('Vector search failed:', error);
      Sentry.captureException(error, {
        tags: { step: 'search' },
        extra: { q_len: queryMetadata.q_len },
      });
      return NextResponse.json(
        {
          error: 'Service error',
          message: 'Failed to search knowledge base',
        },
        { status: 500 }
      );
    }

    // If no results found, return helpful message
    if (searchResults.length === 0) {
      return NextResponse.json({
        answer: "I don't have enough information in my knowledge base to answer that question. Please try rephrasing or ask about a different topic.",
        citations: [],
        q_hash: queryMetadata.q_hash,
        q_len: queryMetadata.q_len,
        model: DEFAULT_CHAT_MODEL,
      });
    }

    // 5. Build RAG prompt with context
    const contexts = searchResults.map((result) => ({
      source_url: result.source_url,
      content: result.content,
    }));

    const messages = buildRAGPrompt(query, contexts);

    // 6. Generate answer using LLM
    let answer: string;
    try {
      answer = await generateChatCompletion({
        messages,
        model: DEFAULT_CHAT_MODEL,
        temperature: 0.7,
        max_tokens: 500,
      });
    } catch (error) {
      console.error('Chat completion failed:', error);
      Sentry.captureException(error, {
        tags: { step: 'generation' },
        extra: { q_len: queryMetadata.q_len, result_count: searchResults.length },
      });
      return NextResponse.json(
        {
          error: 'Service error',
          message: 'Failed to generate answer',
        },
        { status: 500 }
      );
    }

    // 7. Prepare citations
    const citations = searchResults.map((result) => ({
      source_url: result.source_url,
      snippet: result.content.slice(0, 200) + (result.content.length > 200 ? '...' : ''),
    }));

    // 8. Log metrics to Sentry (NO raw query)
    const latencyMs = Date.now() - startTime;
    logQueryMetrics({
      q_hash: queryMetadata.q_hash,
      q_len: queryMetadata.q_len,
      model: DEFAULT_CHAT_MODEL,
      latency_ms: latencyMs,
      result_count: searchResults.length,
    });

    // 9. Return response
    return NextResponse.json({
      answer,
      citations,
      q_hash: queryMetadata.q_hash,
      q_len: queryMetadata.q_len,
      model: DEFAULT_CHAT_MODEL,
    });

  } catch (error) {
    // Catch-all error handler
    console.error('Unhandled error in /api/answer:', error);
    Sentry.captureException(error, {
      tags: { endpoint: '/api/answer' },
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Use POST to submit queries',
    },
    { status: 405 }
  );
}
