import * as Sentry from '@sentry/nextjs';
import { recordMetric } from './metrics-store';

export interface RagMetricSample {
  queryHash: string;
  timestampIso: string;
  endToEndMs: number;
  vectorSearchMs?: number;
  chunksReturned?: number;
  success: boolean;
  tokensUsed?: number;
  costUsd?: number;
  notes?: string;
}

interface TrackerOptions {
  queryHash: string;
}

/**
 * Lightweight metrics tracker for server-side RAG requests.
 * Captures end-to-end latency, vector search time, and chunk counts
 * then emits a structured log plus a Sentry breadcrumb.
 */
export class RagMetricsTracker {
  private readonly queryStart = Date.now();
  private readonly sample: Partial<RagMetricSample>;
  private vectorSearchStart?: number;
  private closed = false;

  constructor(options: TrackerOptions) {
    this.sample = {
      queryHash: options.queryHash,
      success: false,
    };
  }

  measureVectorSearch<T>(fn: () => Promise<T>): Promise<T> {
    this.vectorSearchStart = Date.now();
    return fn().finally(() => {
      this.sample.vectorSearchMs = Date.now() - (this.vectorSearchStart || Date.now());
    });
  }

  setChunkCount(count: number) {
    this.sample.chunksReturned = count;
  }

  setTokensUsed(tokens: number | undefined) {
    if (typeof tokens === 'number') {
      this.sample.tokensUsed = tokens;
    }
  }

  setCostUsd(cost: number | undefined | null) {
    if (typeof cost === 'number' && Number.isFinite(cost)) {
      this.sample.costUsd = Number(cost.toFixed(6));
    }
  }

  markSuccess(notes?: string) {
    this.sample.success = true;
    if (notes) {
      this.sample.notes = notes;
    }
  }

  markFailure(notes?: string) {
    this.sample.success = false;
    if (notes) {
      this.sample.notes = notes;
    }
  }

  finalize(): RagMetricSample {
    if (this.closed) {
      return this.sample as RagMetricSample;
    }

    this.sample.endToEndMs = Date.now() - this.queryStart;
    this.sample.timestampIso = new Date().toISOString();

    const finalizedSample = this.sample as RagMetricSample;

    console.info('[RAG_METRICS]', JSON.stringify(finalizedSample));
    Sentry.addBreadcrumb({
      category: 'rag.metrics',
      level: 'info',
      data: finalizedSample,
    });

    recordMetric(finalizedSample);

    this.closed = true;
    return finalizedSample;
  }
}

export function createMetricsTracker(options: TrackerOptions) {
  return new RagMetricsTracker(options);
}
