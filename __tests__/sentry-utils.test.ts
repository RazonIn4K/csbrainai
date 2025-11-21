/**
 * Unit tests for Sentry PII scrubbing utilities
 * Critical: These tests ensure no raw PII is logged to Sentry
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { hashPII, scrubPII, sanitizeRequest, SENSITIVE_HEADERS } from '../lib/sentry-utils';

// Mock environment variable
process.env.HASH_SALT = 'test-salt-for-testing-only-123456789';

describe('hashPII', () => {
  it('should hash sensitive data with HMAC-SHA256', () => {
    const data = 'user@example.com';
    const result = hashPII(data);

    expect(result).toHaveProperty('hash');
    expect(result).toHaveProperty('length');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex = 64 chars
    expect(result.length).toBe(data.length);
  });

  it('should produce different hashes for different inputs', () => {
    const result1 = hashPII('query1');
    const result2 = hashPII('query2');

    expect(result1.hash).not.toBe(result2.hash);
  });

  it('should produce consistent hashes for same input', () => {
    const data = 'consistent input';
    const result1 = hashPII(data);
    const result2 = hashPII(data);

    expect(result1.hash).toBe(result2.hash);
  });

  it('should throw error if HASH_SALT is missing', () => {
    const originalSalt = process.env.HASH_SALT;
    delete process.env.HASH_SALT;

    expect(() => hashPII('test')).toThrow('HASH_SALT environment variable is required');

    process.env.HASH_SALT = originalSalt;
  });

  it('should never return the original data', () => {
    const sensitive = 'My secret password 123!';
    const result = hashPII(sensitive);

    expect(result.hash).not.toContain(sensitive);
    expect(JSON.stringify(result)).not.toContain(sensitive);
  });
});

describe('scrubPII - String handling', () => {
  it('should scrub plain strings', () => {
    const data = 'user@example.com';
    const result = scrubPII(data);

    expect(result).toHaveProperty('_scrubbed', true);
    expect(result).toHaveProperty('hash');
    expect(result).toHaveProperty('length', data.length);
    expect(result.hash).not.toBe(data);
  });
});

describe('scrubPII - Sensitive fields', () => {
  const sensitiveFields = ['query', 'prompt', 'message', 'email', 'password', 'token', 'authorization', 'cookie'];

  const queryLikeFields = ['query', 'prompt'];
  const otherSensitiveFields = ['message', 'email', 'password', 'token', 'authorization', 'cookie'];

  queryLikeFields.forEach((field) => {
    it(`should normalize query-like field: ${field}`, () => {
      const data = { [field]: 'sensitive-data-123' };
      const result = scrubPII(data);

      expect(result[field]).toHaveProperty('q_hash');
      expect(result[field]).toHaveProperty('q_len', 18);
      expect(result[field]).not.toHaveProperty('_scrubbed');
    });
  });

  otherSensitiveFields.forEach((field) => {
    it(`should scrub sensitive field: ${field}`, () => {
      const data = { [field]: 'sensitive-data-123' };
      const result = scrubPII(data);

      expect(result[field]).toHaveProperty('_scrubbed', true);
      expect(result[field]).toHaveProperty('hash');
      expect(result[field].hash).not.toBe('sensitive-data-123');
    });
  });

  it('should scrub nested sensitive fields', () => {
    const data = {
      user: {
        email: 'user@example.com',
        name: 'John Doe',
      },
    };
    const result = scrubPII(data);

    expect(result.user.email).toHaveProperty('_scrubbed', true);
    expect(result.user.name).toBe('John Doe'); // name is not sensitive
  });

  it('should preserve non-sensitive fields', () => {
    const data = {
      query: 'what is RAG?',
      status: 'success',
      count: 42,
    };
    const result = scrubPII(data);

    expect(result.query).toHaveProperty('q_hash'); // query is sensitive
    expect(result.status).toBe('success'); // status is not sensitive
    expect(result.count).toBe(42); // count is not sensitive
  });
});

describe('scrubPII - Array handling', () => {
  it('should scrub arrays of strings', () => {
    const data = ['query1', 'query2', 'query3'];
    const result = scrubPII(data);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    result.forEach((item: any) => {
      expect(item).toHaveProperty('_scrubbed', true);
      expect(item).toHaveProperty('hash');
    });
  });

  it('should scrub arrays of objects', () => {
    const data = [
      { query: 'test1' },
      { query: 'test2' },
    ];
    const result = scrubPII(data);

    result.forEach((item: any) => {
      expect(item.query).toHaveProperty('q_hash');
    });
  });
});

describe('scrubPII - Edge cases', () => {
  it('should handle null values', () => {
    const result = scrubPII(null);
    expect(result).toBe(null);
  });

  it('should handle undefined values', () => {
    const result = scrubPII(undefined);
    expect(result).toBe(undefined);
  });

  it('should handle numbers', () => {
    const result = scrubPII(123);
    expect(result).toBe(123);
  });

  it('should handle booleans', () => {
    const result = scrubPII(true);
    expect(result).toBe(true);
  });

  it('should handle empty objects', () => {
    const result = scrubPII({});
    expect(result).toEqual({});
  });

  it('should handle empty arrays', () => {
    const result = scrubPII([]);
    expect(result).toEqual([]);
  });
});

describe('sanitizeRequest', () => {
  it('should remove sensitive headers', () => {
    const request = {
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer secret-token',
        'cookie': 'session=abc123',
        'x-api-key': 'secret-key',
      },
    };

    const result = sanitizeRequest(request);

    expect(result.headers).toHaveProperty('content-type', 'application/json');
    expect(result.headers).not.toHaveProperty('authorization');
    expect(result.headers).not.toHaveProperty('cookie');
    expect(result.headers).not.toHaveProperty('x-api-key');
  });

  it('should redact query strings', () => {
    const request = {
      query_string: 'token=secret&key=value',
    };

    const result = sanitizeRequest(request);

    expect(result.query_string).toBe('[REDACTED]');
  });

  it('should scrub request body data', () => {
    const request = {
      data: {
        query: 'what is my password?',
        other: 'safe data',
      },
    };

    const result = sanitizeRequest(request);

    expect(result.data.query).toHaveProperty('q_hash');
    expect(result.data.other).toBe('safe data');
  });

  it('should handle requests with no headers', () => {
    const request = { url: '/api/test' };
    const result = sanitizeRequest(request);

    expect(result).toEqual({ url: '/api/test' });
  });

  it('should handle null request', () => {
    const result = sanitizeRequest(null);
    expect(result).toBe(null);
  });
});

describe('SENSITIVE_HEADERS constant', () => {
  it('should include common sensitive header names', () => {
    const expected = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'x-csrf-token'];

    expected.forEach((header) => {
      expect(SENSITIVE_HEADERS).toContain(header);
    });
  });
});

describe('PII scrubbing - Real-world scenarios', () => {
  it('should scrub RAG query event', () => {
    const event = {
      contexts: {
        rag: {
          query: 'What is my personal information?',
          status: 'processing',
        },
      },
      extra: {
        prompt: 'Answer this: What is my SSN?',
        metadata: {
          count: 5,
        },
      },
    };

    const contexts = scrubPII(event.contexts);
    const extra = scrubPII(event.extra);

    // Sensitive fields scrubbed
    expect(contexts.rag.query).toHaveProperty('q_hash');
    expect(extra.prompt).toHaveProperty('q_hash');

    // Non-sensitive preserved
    expect(contexts.rag.status).toBe('processing');
    expect(extra.metadata.count).toBe(5);
  });

  it('should never leak raw queries in any structure', () => {
    const rawQuery = 'my-secret-query-12345';
    const structures = [
      { query: rawQuery },
      { data: { query: rawQuery } },
      { items: [{ query: rawQuery }] },
      { nested: { deep: { query: rawQuery } } },
    ];

    structures.forEach((structure) => {
      const scrubbed = scrubPII(structure);
      const serialized = JSON.stringify(scrubbed);

      expect(serialized).not.toContain(rawQuery);
    });
  });

  it('should handle Sentry breadcrumb data', () => {
    const breadcrumb = {
      category: 'rag',
      message: 'Query received',
      data: {
        q_hash: 'abc123',
        q_len: 42,
        query: 'sensitive query', // Should not be here, but test defensively
      },
    };

    const result = scrubPII(breadcrumb.data);

    expect(result.q_hash).toBe('abc123'); // Safe metadata preserved
    expect(result.q_len).toBe(42); // Safe metadata preserved
    expect(result.query).toHaveProperty('q_hash'); // Query scrubbed
  });
});
