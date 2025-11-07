/**
 * Rate Limiter Implementation
 * Primary: Upstash Redis (optional dependency)
 * Fallback: In-memory Token Bucket algorithm
 */

import type { NextRequest } from 'next/server';

// Token Bucket Implementation (Fallback)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const RATE_LIMIT = {
  maxRequests: 10, // requests per window
  windowMs: 60 * 1000, // 1 minute
  tokensPerInterval: 10,
  maxTokens: 10,
};

/**
 * Token bucket rate limiting (in-memory fallback)
 */
function tokenBucketLimit(identifier: string): { success: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = {
      tokens: RATE_LIMIT.maxTokens,
      lastRefill: now,
    };
    buckets.set(identifier, bucket);
  }

  // Refill tokens based on time elapsed
  const timePassed = now - bucket.lastRefill;
  const intervalsElapsed = timePassed / RATE_LIMIT.windowMs;
  const tokensToAdd = Math.floor(intervalsElapsed * RATE_LIMIT.tokensPerInterval);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(RATE_LIMIT.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // Try to consume a token
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { success: true, remaining: bucket.tokens };
  }

  return { success: false, remaining: 0 };
}

/**
 * Cleanup old buckets periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request (IP address)
 */
function getIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (behind proxy)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP
  return request.ip || 'unknown';
}

/**
 * Main rate limiting function
 * Tries Upstash Redis first, falls back to token bucket
 */
export async function rateLimit(
  request: NextRequest
): Promise<{ success: boolean; limit: number; remaining: number; reset?: number }> {
  const identifier = getIdentifier(request);

  // Try Upstash Redis if available
  try {
    // Dynamic import to handle optional dependency
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT.maxRequests, `${RATE_LIMIT.windowMs}ms`),
      analytics: true,
      prefix: 'csbrainai:ratelimit',
    });

    const result = await ratelimit.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    // Fall back to token bucket
    console.warn('Upstash rate limiter unavailable, using token bucket fallback');
    const result = tokenBucketLimit(identifier);
    return {
      success: result.success,
      limit: RATE_LIMIT.maxTokens,
      remaining: result.remaining,
    };
  }
}
