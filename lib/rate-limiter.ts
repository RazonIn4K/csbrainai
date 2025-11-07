/**
 * Rate Limiter Implementation
 * Primary: Upstash Redis (optional dependency)
 * Fallback: In-memory Token Bucket algorithm (development only)
 */

import type { NextRequest } from 'next/server';

// Token Bucket Implementation (Fallback)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

export const RATE_LIMIT_RULE = {
  maxRequests: 10, // requests per window
  windowMs: 60 * 1000, // 1 minute
  tokensPerInterval: 10,
  maxTokens: 10,
};

/**
 * Token bucket rate limiting (in-memory fallback)
 */
function tokenBucketLimit(identifier: string): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = {
      tokens: RATE_LIMIT_RULE.maxTokens,
      lastRefill: now,
    };
    buckets.set(identifier, bucket);
  }

  // Refill tokens based on time elapsed
  const timePassed = now - bucket.lastRefill;
  const intervalsElapsed = timePassed / RATE_LIMIT_RULE.windowMs;
  const tokensToAdd = Math.floor(intervalsElapsed * RATE_LIMIT_RULE.tokensPerInterval);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(RATE_LIMIT_RULE.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // Try to consume a token
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { success: true, remaining: bucket.tokens, reset: now + RATE_LIMIT_RULE.windowMs };
  }

  return { success: false, remaining: 0, reset: bucket.lastRefill + RATE_LIMIT_RULE.windowMs };
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
 * Normalize a reset timestamp (seconds or milliseconds) into milliseconds.
 */
function normalizeResetTimestamp(reset?: number): number | undefined {
  if (typeof reset !== 'number' || Number.isNaN(reset)) {
    return undefined;
  }

  // Upstash returns epoch seconds; fallbacks may use milliseconds
  return reset > 1e12 ? reset : reset * 1000;
}

/**
 * Error thrown when rate limiting cannot be enforced securely.
 */
export class RateLimitUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitUnavailableError';
  }
}

/**
 * Main rate limiting function
 * Tries Upstash Redis first, falls back to token bucket
 */
export async function rateLimit(
  request: NextRequest
): Promise<{ success: boolean; limit: number; remaining: number; reset?: number }> {
  const identifier = getIdentifier(request);
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  const hasUpstashConfig = Boolean(upstashUrl && upstashToken);

  if (hasUpstashConfig) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({
        url: upstashUrl!,
        token: upstashToken!,
      });

      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_RULE.maxRequests,
          `${RATE_LIMIT_RULE.windowMs}ms`
        ),
        analytics: true,
        prefix: 'csbrainai:ratelimit',
      });

      const result = await ratelimit.limit(identifier);
      const resetMs = normalizeResetTimestamp(result.reset);

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: resetMs,
      };
    } catch (error) {
      console.error('Upstash rate limiter error:', error);
      if (isProduction) {
        throw new RateLimitUnavailableError('Upstash rate limiter unavailable in production');
      }
    }
  } else if (isProduction) {
    throw new RateLimitUnavailableError('Upstash environment variables missing in production');
  }

  const result = tokenBucketLimit(identifier);
  console.warn('Using in-memory token bucket fallback for rate limiting');
  return {
    success: result.success,
    limit: RATE_LIMIT_RULE.maxTokens,
    remaining: result.remaining,
    reset: result.reset,
  };
}
