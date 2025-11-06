/**
 * Next.js 13+ Instrumentation API
 * Runs once during server initialization to set up Sentry
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry
    const { initServerSentry } = await import('./lib/sentry/server');
    initServerSentry();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry (if needed)
    const { initServerSentry } = await import('./lib/sentry/server');
    initServerSentry();
  }
}
