import * as Sentry from '@sentry/nextjs';
import { scrubPII, sanitizeRequest } from './lib/sentry-utils';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // PII Scrubbing - Server Side (More Critical)
  beforeSend(event, hint) {
    // Scrub PII from request data
    if (event.request) {
      event.request = sanitizeRequest(event.request);
    }

    // Scrub PII from event contexts
    if (event.contexts) {
      event.contexts = scrubPII(event.contexts);
    }

    // Scrub PII from extra data
    if (event.extra) {
      event.extra = scrubPII(event.extra);
    }

    // Remove breadcrumbs that might contain PII
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        // Only redact messages that might contain sensitive data
        // Safe messages like "Query received", "Answer generated" are preserved
        let safeMessage = breadcrumb.message;
        if (breadcrumb.message) {
          const sensitivePatterns = /query|password|email|token|secret|key|credential/i;
          // Redact message content (not category labels) if it matches sensitive patterns
          if (breadcrumb.category !== 'rag' && sensitivePatterns.test(breadcrumb.message)) {
            safeMessage = '[REDACTED]';
          }
        }

        return {
          ...breadcrumb,
          data: breadcrumb.data ? scrubPII(breadcrumb.data) : undefined,
          message: safeMessage,
        };
      });
    }

    return event;
  },
});
