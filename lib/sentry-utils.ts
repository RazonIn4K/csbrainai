import * as crypto from 'crypto';

/**
 * Privacy-first utility to hash sensitive data before logging to Sentry.
 * Uses HMAC-SHA256 to create irreversible hash of PII.
 *
 * @param data - The sensitive data to hash
 * @returns Object containing hash and original length
 */
export function hashPII(data: string): { hash: string; length: number } {
  const salt = process.env.HASH_SALT;
  if (!salt) {
    throw new Error('HASH_SALT environment variable is required for PII hashing');
  }

  const hash = crypto
    .createHmac('sha256', salt)
    .update(data)
    .digest('hex');

  return {
    hash,
    length: data.length,
  };
}

/**
 * Scrub PII from Sentry event data.
 * Replaces sensitive fields with hashed versions and normalizes query-like fields
 * to `{ q_hash, q_len }` for consistent privacy-safe logging.
 */
export function scrubPII(data: any): any {
  if (typeof data === 'string') {
    // Hash string data
    const { hash, length } = hashPII(data);
    return { _scrubbed: true, hash, length };
  }

  if (Array.isArray(data)) {
    return data.map(scrubPII);
  }

  if (data && typeof data === 'object') {
    const scrubbed: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const queryLikeFields = ['query', 'prompt', 'question'];
      const sensitiveFields = [
        'message',
        'email',
        'password',
        'token',
        'authorization',
        'cookie',
      ];

      if (queryLikeFields.some((field) => lowerKey.includes(field)) && typeof value === 'string') {
        const { hash, length } = hashPII(value);
        scrubbed[key] = { q_hash: hash, q_len: length };
      } else if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        if (typeof value === 'string') {
          const { hash, length } = hashPII(value);
          scrubbed[key] = { _scrubbed: true, hash, length };
        } else {
          scrubbed[key] = '[SCRUBBED]';
        }
      } else {
        scrubbed[key] = scrubPII(value);
      }
    }
    return scrubbed;
  }

  return data;
}

/**
 * Headers that should never be logged to Sentry
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
];

/**
 * Sanitize request data before sending to Sentry
 */
export function sanitizeRequest(request: any): any {
  if (!request) return request;

  const sanitized = { ...request };

  // Remove sensitive headers
  if (sanitized.headers) {
    const cleanHeaders: any = {};
    for (const [key, value] of Object.entries(sanitized.headers)) {
      if (!SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        cleanHeaders[key] = value;
      }
    }
    sanitized.headers = cleanHeaders;
  }

  // Scrub query parameters
  if (sanitized.query_string) {
    sanitized.query_string = '[REDACTED]';
  }

  // Scrub request body
  if (sanitized.data) {
    sanitized.data = scrubPII(sanitized.data);
  }

  return sanitized;
}
