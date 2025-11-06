import { createHmac, createHash } from 'crypto';

/**
 * HMAC-SHA256 hashing for query anonymization
 * Uses HASH_SALT from environment for keyed hashing
 *
 * PRIVACY: We store ONLY the hash and length, never the raw query text.
 *
 * @param text - Text to hash (e.g., user query)
 * @returns Hex-encoded hash string
 */
export function hashQuery(text: string): string {
  const salt = process.env.HASH_SALT;

  if (!salt) {
    throw new Error('HASH_SALT not configured');
  }

  return createHmac('sha256', salt).update(text).digest('hex');
}

/**
 * SHA-256 hash for chunk deduplication
 * Used for chunk_hash in database (source_url + content)
 *
 * @param text - Text to hash
 * @returns Hex-encoded hash string
 */
export function hashChunk(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Query metadata for telemetry (PII-safe)
 */
export interface QueryMetadata {
  q_hash: string; // HMAC-SHA256 hash
  q_len: number; // String length
}

/**
 * Create PII-safe query metadata
 * This is the ONLY query data we store/log
 */
export function createQueryMetadata(query: string): QueryMetadata {
  return {
    q_hash: hashQuery(query),
    q_len: query.length,
  };
}
