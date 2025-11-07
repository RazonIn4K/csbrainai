import { beforeAll, describe, expect, test } from 'vitest';
import { hashPII, sanitizeRequest, scrubPII } from '../lib/sentry-utils';

beforeAll(() => {
  process.env.HASH_SALT = 'test-salt';
});

describe('scrubPII', () => {
  test('hashes raw string values with metadata', () => {
    const result = scrubPII('super secret');

    expect(result).toHaveProperty('_scrubbed', true);
    expect(result).toHaveProperty('length', 'super secret'.length);
    expect(result).toHaveProperty('hash');
    expect((result as any).hash).toHaveLength(64);

    const expected = hashPII('super secret');
    expect((result as any).hash).toBe(expected.hash);
  });

  test('recursively scrubs sensitive object fields', () => {
    const payload = {
      query: 'find user details',
      metadata: {
        email: 'user@example.com',
        nested: {
          password: 'hunter2',
        },
      },
      safe: 'public info',
    };

    const scrubbed = scrubPII(payload) as any;

    expect(scrubbed.query).toMatchObject({ q_len: payload.query.length });
    expect(scrubbed.query).toHaveProperty('q_hash');
    expect(scrubbed.metadata.email).toMatchObject({ _scrubbed: true, length: payload.metadata.email.length });
    expect(scrubbed.metadata.nested.password).toMatchObject({
      _scrubbed: true,
      length: payload.metadata.nested.password.length,
    });
    expect(scrubbed.safe).toMatchObject({ _scrubbed: true, length: payload.safe.length });
  });
});

describe('sanitizeRequest', () => {
  test('removes sensitive headers and scrubs body content', () => {
    const request = {
      headers: {
        Authorization: 'Bearer token',
        'X-Forwarded-For': '203.0.113.42',
      },
      query_string: 'q=secret',
      data: {
        prompt: 'tell me everything',
      },
    };

    const sanitized = sanitizeRequest(request) as any;

    expect(sanitized.headers.Authorization).toBeUndefined();
    expect(sanitized.headers['X-Forwarded-For']).toBe('203.0.113.42');
    expect(sanitized.query_string).toBe('[REDACTED]');
    expect(sanitized.data.prompt).toMatchObject({ q_len: 'tell me everything'.length });
    expect(sanitized.data.prompt).toHaveProperty('q_hash');
  });
});
