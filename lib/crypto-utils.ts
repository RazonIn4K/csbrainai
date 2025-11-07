import * as crypto from 'crypto';

/**
 * Generate HMAC-SHA256 hash of input data using the HASH_SALT environment variable.
 * Used for creating irreversible, deterministic hashes of sensitive data.
 *
 * @param data - The data to hash
 * @returns Hex-encoded hash string
 */
export function generateHMAC(data: string): string {
  const salt = process.env.HASH_SALT;
  if (!salt) {
    throw new Error('HASH_SALT environment variable is required');
  }

  return crypto
    .createHmac('sha256', salt)
    .update(data)
    .digest('hex');
}

/**
 * Create a privacy-safe representation of a query for logging.
 * Returns only the hash and length, never the original content.
 *
 * @param query - The original query string
 * @returns Object with hash and length
 */
export function hashQuery(query: string): { hash: string; length: number } {
  return {
    hash: generateHMAC(query),
    length: query.length,
  };
}
