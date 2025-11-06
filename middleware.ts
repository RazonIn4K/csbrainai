import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSecurityHeaders } from './lib/security/headers';
import { checkRateLimit, getClientIdentifier } from './lib/security/rate-limit';

/**
 * Next.js middleware for security headers and rate limiting
 * Runs on every request before reaching API routes
 */
export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const identifier = getClientIdentifier(request);
    const allowed = await checkRateLimit(identifier);

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retry_after: 60,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            ...getSecurityHeaders(),
          },
        }
      );
    }
  }

  // Continue with request and apply security headers
  const response = NextResponse.next();

  // Apply security headers to all responses
  const headers = getSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
