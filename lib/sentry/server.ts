import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry initialization with PII scrubbing and performance tracing.
 * L5 Observability: Track errors, performance, and custom spans.
 */
export function initServerSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not configured for server');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2, // 20% performance tracing

    // PII Scrubbing: Strip all sensitive data
    beforeSend(event, hint) {
      // Remove request data
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        // Strip query params
        if (event.request.url) {
          event.request.url = event.request.url.split('?')[0];
        }
      }

      // Remove breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: undefined,
        }));
      }

      // Scrub exception messages
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exception) => ({
          ...exception,
          value: exception.value
            ? scrubSensitiveData(exception.value)
            : exception.value,
        }));
      }

      // Remove user context
      delete event.user;
      delete event.contexts?.user;

      return event;
    },

    // Custom integration for context
    integrations: [
      Sentry.extraErrorDataIntegration({ depth: 3 }),
    ],
  });
}

/**
 * Scrub sensitive patterns from strings
 */
function scrubSensitiveData(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\d{3}[-.]?){2}\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]')
    .replace(/sk-[A-Za-z0-9]{48}/g, '[API_KEY]')
    .replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer [TOKEN]');
}

/**
 * Helper: Log query metadata to Sentry (NOT the raw query)
 */
export function logQueryMetrics(metadata: {
  q_hash: string;
  q_len: number;
  model: string;
  latency_ms: number;
  result_count: number;
}) {
  Sentry.addBreadcrumb({
    category: 'rag.query',
    message: 'RAG query processed',
    level: 'info',
    data: metadata, // Only hashed/numeric data, NO raw query
  });
}
