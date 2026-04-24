import { NextRequest } from 'next/server';

import { POST } from '../app/api/answer/route';
import { generateAnswer, generateEmbedding } from '../lib/openai';
import { rateLimit } from '../lib/rate-limiter';
import { searchDocuments } from '../lib/supabase';

process.env.HASH_SALT = 'test-salt-for-testing-only-123456789';

jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('../lib/openai', () => ({
  CHAT_MODEL: 'gpt-4o-mini',
  OpenAIConfigurationError: class OpenAIConfigurationError extends Error {},
  generateEmbedding: jest.fn(),
  generateAnswer: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  searchDocuments: jest.fn(),
}));

jest.mock('../lib/rate-limiter', () => ({
  RateLimitUnavailableError: class RateLimitUnavailableError extends Error {},
  rateLimit: jest.fn(),
}));

jest.mock('../lib/metrics', () => ({
  createMetricsTracker: jest.fn(() => ({
    measureVectorSearch: jest.fn((callback) => callback()),
    setChunkCount: jest.fn(),
    setTokensUsed: jest.fn(),
    setCostUsd: jest.fn(),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
    finalize: jest.fn(),
  })),
}));

jest.mock('../lib/cost-estimator', () => ({
  estimateLlmCost: jest.fn().mockResolvedValue({ costUsd: 0.001 }),
}));

const mockedGenerateEmbedding = jest.mocked(generateEmbedding);
const mockedGenerateAnswer = jest.mocked(generateAnswer);
const mockedRateLimit = jest.mocked(rateLimit);
const mockedSearchDocuments = jest.mocked(searchDocuments);

describe('/api/answer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
    mockedGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockedSearchDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        source_url: 'https://example.com/rag',
        content: 'Test chunk 1',
        similarity: 0.9,
      },
      {
        id: 'doc-2',
        source_url: 'https://example.com/privacy',
        content: 'Test chunk 2',
        similarity: 0.8,
      },
    ]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'This is a test answer.',
      tokensUsed: 42,
      usage: {
        promptTokens: 30,
        completionTokens: 12,
        totalTokens: 42,
      },
    });
  });

  it('returns an answer, citations, and privacy-safe query metadata', async () => {
    const request = new NextRequest('http://localhost/api/answer', {
      method: 'POST',
      body: JSON.stringify({ query: 'What is RAG?' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      answer: 'This is a test answer.',
      q_len: 'What is RAG?'.length,
      tokensUsed: 42,
    });
    expect(data.q_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.citations).toEqual([
      {
        source_url: 'https://example.com/rag',
        content: 'Test chunk 1...',
        similarity: 0.9,
      },
      {
        source_url: 'https://example.com/privacy',
        content: 'Test chunk 2...',
        similarity: 0.8,
      },
    ]);
    expect(mockedGenerateEmbedding).toHaveBeenCalledWith('What is RAG?');
    expect(mockedSearchDocuments).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      matchThreshold: 0.5,
      matchCount: 5,
    });
    expect(mockedGenerateAnswer).toHaveBeenCalledWith('What is RAG?', [
      'Test chunk 1',
      'Test chunk 2',
    ]);
  });
});
