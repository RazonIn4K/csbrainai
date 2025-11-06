import * as Sentry from '@sentry/nextjs';

/**
 * Client-side Sentry initialization with aggressive PII scrubbing.
 * L5 Observability: All errors/events sanitized before transmission.
 */
export function initClientSentry() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn('Sentry DSN not configured for client');
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% performance monitoring

    // PII Scrubbing: Strip all sensitive data before sending to Sentry
    beforeSend(event, hint) {
      // Remove request data (query params, body, cookies)
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        // Strip query params from URL
        if (event.request.url) {
          event.request.url = event.request.url.split('?')[0];
        }
      }

      // Remove breadcrumb data (may contain user input)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: undefined, // Strip all breadcrumb data
        }));
      }

      // Remove exception values that might contain PII
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exception) => ({
          ...exception,
          value: exception.value
            ? exception.value.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            : exception.value,
        }));
      }

      // Remove user context
      delete event.user;

      return event;
    },

    // Never send PII in breadcrumbs
    beforeBreadcrumb(breadcrumb, hint) {
      // Strip console log arguments
      if (breadcrumb.category === 'console') {
        return null; // Drop console breadcrumbs entirely
      }

      // Strip fetch/XHR data
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        return {
          ...breadcrumb,
          data: {
            method: breadcrumb.data?.method,
            status_code: breadcrumb.data?.status_code,
            // URL without query params
            url: breadcrumb.data?.url?.split('?')[0],
          },
        };
      }

      return breadcrumb;
    },

    // Ignore common browser errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
}
