import * as Sentry from '@sentry/nextjs';

/**
 * Next.js instrumentation hook. Without this file, sentry.server.config.ts is
 * never loaded and server-side Sentry silently stays off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
