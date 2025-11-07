import * as Sentry from '@sentry/nextjs';
import { scrubPII, sanitizeRequest } from './lib/sentry-utils';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // PII Scrubbing - Client Side
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
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        data: breadcrumb.data ? scrubPII(breadcrumb.data) : undefined,
      }));
    }

    return event;
  },
});
