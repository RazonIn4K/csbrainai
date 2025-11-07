import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, RateLimitUnavailableError, RATE_LIMIT_RULE } from './lib/rate-limiter';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply Security Headers
  const securityHeaders = {
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.openai.com https://*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),

    // Security Headers
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

    // HSTS (Strict Transport Security)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply Rate Limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      const rateLimitResult = await rateLimit(request);

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());

      if (rateLimitResult.reset) {
        const resetSeconds = Math.ceil(rateLimitResult.reset / 1000);
        response.headers.set('X-RateLimit-Reset', resetSeconds.toString());
      }

      // Block request if rate limit exceeded
      if (!rateLimitResult.success) {
        const retryAfterSeconds = rateLimitResult.reset
          ? Math.max(1, Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
          : Math.ceil(RATE_LIMIT_RULE.windowMs / 1000);

        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfterSeconds.toString(),
              ...Object.fromEntries(response.headers),
            },
          }
        );
      }
    } catch (error) {
      console.error('Rate limiting error:', error);

      if (error instanceof RateLimitUnavailableError) {
        return new NextResponse(
          JSON.stringify({
            error: 'Service Unavailable',
            message: 'Rate limiting temporarily unavailable. Please try again later.',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(response.headers),
            },
          }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
