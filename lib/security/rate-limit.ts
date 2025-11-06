/**
 * Rate limiting implementation with Upstash Redis (preferred) or in-memory fallback.
 *
 * Production: Use Upstash Redis for distributed rate limiting
 * Development: Falls back to token bucket algorithm (non-distributed)
 */

// Token bucket state (in-memory fallback)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/**
 * Rate limit configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRequests: 10, // Max requests per window
  windowMs: 60 * 1000, // 1 minute window
  tokensPerRefill: 10,
  refillIntervalMs: 60 * 1000,
};

/**
 * Check rate limit for a given identifier (usually IP address)
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  // Try Upstash Redis first (if configured)
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    return checkRateLimitRedis(identifier);
  }

  // Fallback to in-memory token bucket
  return checkRateLimitMemory(identifier);
}

/**
 * Upstash Redis-based rate limiting (distributed, production-ready)
 */
async function checkRateLimitRedis(identifier: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_URL!;
  const token = process.env.UPSTASH_REDIS_TOKEN!;

  try {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

    // Use Redis sorted set to track requests in sliding window
    const commands = [
      // Remove old entries outside window
      ['ZREMRANGEBYSCORE', key, '0', windowStart.toString()],
      // Count remaining entries
      ['ZCARD', key],
      // Add current request
      ['ZADD', key, now.toString(), `${now}-${Math.random()}`],
      // Set expiry
      ['EXPIRE', key, Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000)],
    ];

    // Execute pipeline
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      console.error('Upstash Redis error:', response.statusText);
      return true; // Fail open (allow request on error)
    }

    const results = await response.json();
    const count = results[1]?.result || 0;

    return count <= RATE_LIMIT_CONFIG.maxRequests;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open
  }
}

/**
 * In-memory token bucket rate limiting (fallback, not distributed)
 * TODO: Replace with Redis for multi-instance deployments
 */
function checkRateLimitMemory(identifier: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    // Initialize new bucket
    bucket = {
      tokens: RATE_LIMIT_CONFIG.tokensPerRefill,
      lastRefill: now,
    };
    buckets.set(identifier, bucket);
  }

  // Refill tokens based on time elapsed
  const timeSinceRefill = now - bucket.lastRefill;
  const refillsElapsed = Math.floor(timeSinceRefill / RATE_LIMIT_CONFIG.refillIntervalMs);

  if (refillsElapsed > 0) {
    bucket.tokens = Math.min(
      RATE_LIMIT_CONFIG.tokensPerRefill,
      bucket.tokens + refillsElapsed * RATE_LIMIT_CONFIG.tokensPerRefill
    );
    bucket.lastRefill = now;
  }

  // Check if tokens available
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }

  return false;
}

/**
 * Get client identifier (IP address or fallback)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Clean up old buckets (run periodically if using memory store)
 */
export function cleanupRateLimitBuckets() {
  const now = Date.now();
  const maxAge = RATE_LIMIT_CONFIG.windowMs * 2;

  for (const [identifier, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(identifier);
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitBuckets, 5 * 60 * 1000);
}
