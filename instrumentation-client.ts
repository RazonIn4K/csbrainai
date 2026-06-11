/**
 * Client-side Sentry bootstrap. Next.js 16 (Turbopack) does not inject the
 * legacy sentry.client.config.ts filename; it must be imported from here.
 */
import './sentry.client.config';

import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
