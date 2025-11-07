/**
 * Unit tests for crypto utilities (HMAC hashing)
 * Critical: Ensures query hashing is deterministic and secure
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateHMAC, hashQuery } from '../lib/crypto-utils';

// Mock environment variable
process.env.HASH_SALT = 'test-salt-for-testing-only-123456789';

describe('generateHMAC', () => {
  it('should generate SHA-256 HMAC hash', () => {
    const data = 'test data';
    const hash = generateHMAC(data);

    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 = 64 hex chars
  });

  it('should be deterministic (same input -> same hash)', () => {
    const data = 'consistent data';
    const hash1 = generateHMAC(data);
    const hash2 = generateHMAC(data);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = generateHMAC('input1');
    const hash2 = generateHMAC('input2');

    expect(hash1).not.toBe(hash2);
  });

  it('should throw error if HASH_SALT is not set', () => {
    const originalSalt = process.env.HASH_SALT;
    delete process.env.HASH_SALT;

    expect(() => generateHMAC('test')).toThrow('HASH_SALT environment variable is required');

    process.env.HASH_SALT = originalSalt;
  });

  it('should never expose the original data in hash', () => {
    const sensitive = 'MySuperSecretPassword123!';
    const hash = generateHMAC(sensitive);

    expect(hash).not.toContain(sensitive);
    expect(hash).not.toContain('Password');
    expect(hash).not.toContain('Secret');
  });

  it('should handle unicode characters', () => {
    const unicode = 'Hello 世界 🌍';
    const hash = generateHMAC(unicode);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('世界');
    expect(hash).not.toContain('🌍');
  });

  it('should handle empty strings', () => {
    const hash = generateHMAC('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle very long strings', () => {
    const longString = 'a'.repeat(10000);
    const hash = generateHMAC(longString);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashQuery', () => {
  it('should return hash and length', () => {
    const query = 'What is RAG?';
    const result = hashQuery(query);

    expect(result).toHaveProperty('hash');
    expect(result).toHaveProperty('length');
    expect(result.length).toBe(query.length);
  });

  it('should produce consistent hashes for same query', () => {
    const query = 'How does vector search work?';
    const result1 = hashQuery(query);
    const result2 = hashQuery(query);

    expect(result1.hash).toBe(result2.hash);
    expect(result1.length).toBe(result2.length);
  });

  it('should never expose the original query', () => {
    const query = 'What is my social security number?';
    const result = hashQuery(query);

    expect(result.hash).not.toContain(query);
    expect(result.hash).not.toContain('security');
    expect(JSON.stringify(result)).not.toContain(query);
  });

  it('should handle queries with PII', () => {
    const query = 'My email is john@example.com and my phone is 555-1234';
    const result = hashQuery(query);

    expect(result.hash).not.toContain('john@example.com');
    expect(result.hash).not.toContain('555-1234');
    expect(result.length).toBe(query.length); // But length is preserved
  });

  it('should count unicode characters correctly', () => {
    const query = '你好世界'; // 4 characters
    const result = hashQuery(query);

    expect(result.length).toBe(4);
  });

  it('should differentiate between similar queries', () => {
    const query1 = 'What is RAG?';
    const query2 = 'What is rag?'; // lowercase
    const result1 = hashQuery(query1);
    const result2 = hashQuery(query2);

    expect(result1.hash).not.toBe(result2.hash);
  });
});

describe('Hash collision resistance', () => {
  it('should produce unique hashes for many different inputs', () => {
    const hashes = new Set<string>();
    const inputs = [
      'query1',
      'query2',
      'query3',
      'What is RAG?',
      'How does embeddings work?',
      'Explain vector similarity',
      'a',
      'aa',
      'aaa',
      '123',
      '1234',
      'test' + 'test',
      'testtest',
    ];

    inputs.forEach((input) => {
      const hash = generateHMAC(input);
      hashes.add(hash);
    });

    // All hashes should be unique
    expect(hashes.size).toBe(inputs.length);
  });
});

describe('Privacy-critical scenarios', () => {
  it('should safely log query metadata without exposing content', () => {
    const userQuery = 'What is my credit card number?';
    const { hash, length } = hashQuery(userQuery);

    // Safe to log
    const safeLog = {
      q_hash: hash,
      q_len: length,
      timestamp: new Date().toISOString(),
    };

    const logString = JSON.stringify(safeLog);
    expect(logString).not.toContain('credit card');
    expect(logString).not.toContain('number');
    expect(logString).not.toContain(userQuery);
  });

  it('should allow query deduplication without exposing content', () => {
    const query1 = 'sensitive question';
    const query2 = 'sensitive question'; // Duplicate
    const query3 = 'different question';

    const hash1 = hashQuery(query1).hash;
    const hash2 = hashQuery(query2).hash;
    const hash3 = hashQuery(query3).hash;

    // Can detect duplicate queries
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);

    // But can't reverse engineer original
    expect(hash1).not.toContain('sensitive');
  });

  it('should work with real RAG query patterns', () => {
    const realQueries = [
      'What is RAG and how does it work?',
      'How do I implement vector search?',
      'Explain the difference between RAG and fine-tuning',
      'What database supports pgvector?',
      'How to secure my API endpoints?',
    ];

    realQueries.forEach((query) => {
      const result = hashQuery(query);

      // Verify privacy
      expect(result.hash).not.toContain(query);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);

      // Verify metadata
      expect(result.length).toBe(query.length);
    });
  });
});
