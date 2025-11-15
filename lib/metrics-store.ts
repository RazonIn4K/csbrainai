import fs from 'fs';
import path from 'path';
import type { RagMetricSample } from './metrics';

const MAX_SAMPLES = 200;
const LOG_PATH = process.env.RAG_METRICS_LOG_PATH || path.join(process.cwd(), '.rag-metrics-log.jsonl');
const MAX_LOG_LINES = Number(process.env.RAG_METRICS_MAX_LINES || '500');
const DISABLE_DISK_LOG = process.env.RAG_METRICS_DISABLE_DISK === '1';
const fsPromises = fs.promises;
let trimScheduled = false;

type MetricsStore = {
  samples: RagMetricSample[];
};

const globalWithStore = globalThis as typeof globalThis & {
  __CSBRAINAI_METRICS_STORE__?: MetricsStore;
};

function getStore(): MetricsStore {
  if (!globalWithStore.__CSBRAINAI_METRICS_STORE__) {
    globalWithStore.__CSBRAINAI_METRICS_STORE__ = { samples: [] };
  }
  return globalWithStore.__CSBRAINAI_METRICS_STORE__;
}

export function recordMetric(sample: RagMetricSample) {
  const store = getStore();
  store.samples.push(sample);
  if (store.samples.length > MAX_SAMPLES) {
    store.samples.splice(0, store.samples.length - MAX_SAMPLES);
  }

  persistSample(sample);
}

function persistSample(sample: RagMetricSample) {
  if (DISABLE_DISK_LOG) {
    return;
  }

  fsPromises
    .appendFile(LOG_PATH, JSON.stringify(sample) + '\n', { encoding: 'utf-8' })
    .then(() => scheduleTrim())
    .catch((error) => {
      console.error('Failed to append RAG metrics log:', error);
    });
}

function scheduleTrim() {
  if (trimScheduled || MAX_LOG_LINES <= 0) {
    return;
  }

  trimScheduled = true;
  setTimeout(async () => {
    try {
      const data = await fsPromises.readFile(LOG_PATH, 'utf-8');
      const lines = data
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length > MAX_LOG_LINES) {
        const trimmed = lines.slice(-MAX_LOG_LINES).join('\n') + '\n';
        await fsPromises.writeFile(LOG_PATH, trimmed, 'utf-8');
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('Failed to trim RAG metrics log:', error);
      }
    } finally {
      trimScheduled = false;
    }
  }, 0);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, value) => acc + value, 0);
  return sum / numbers.length;
}

export function getMetricsSummary(windowSize = 50) {
  const store = getStore();
  const samples = store.samples;
  const windowSamples = windowSize > 0 ? samples.slice(-windowSize) : samples.slice();

  if (windowSamples.length === 0) {
    return {
      totals: {
        count: 0,
        successCount: 0,
        errorCount: 0,
        errorRate: 0,
      },
      latency: {
        avgEndToEndMs: 0,
        avgVectorSearchMs: 0,
      },
      retrieval: {
        avgChunks: 0,
      },
      cost: {
        avgCostUsd: 0,
      },
      recent: [],
      windowStart: null,
      windowEnd: null,
    };
  }

  const successCount = windowSamples.filter((sample) => sample.success).length;
  const errorCount = windowSamples.length - successCount;
  const latencyValues = windowSamples.map((sample) => sample.endToEndMs);
  const vectorValues = windowSamples
    .map((sample) => sample.vectorSearchMs)
    .filter((value): value is number => typeof value === 'number');
  const chunkValues = windowSamples
    .map((sample) => sample.chunksReturned)
    .filter((value): value is number => typeof value === 'number');

  const costValues = windowSamples
    .map((sample) => sample.costUsd)
    .filter((value): value is number => typeof value === 'number');

  return {
    totals: {
      count: windowSamples.length,
      successCount,
      errorCount,
      errorRate: windowSamples.length ? errorCount / windowSamples.length : 0,
    },
    latency: {
      avgEndToEndMs: average(latencyValues),
      avgVectorSearchMs: average(vectorValues),
    },
    retrieval: {
      avgChunks: average(chunkValues),
    },
    cost: {
      avgCostUsd: average(costValues),
    },
    recent: windowSamples.slice(-5),
    windowStart: windowSamples[0].timestampIso,
    windowEnd: windowSamples[windowSamples.length - 1].timestampIso,
  };
}

export function getMetricsLogPath() {
  return LOG_PATH;
}

export async function readPersistedMetrics(limit = 100): Promise<RagMetricSample[]> {
  try {
    const data = await fsPromises.readFile(LOG_PATH, 'utf-8');
    const lines = data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const recentLines = lines.slice(-limit);
    return recentLines
      .map((line) => {
        try {
          return JSON.parse(line) as RagMetricSample;
        } catch (error) {
          return null;
        }
      })
      .filter((sample): sample is RagMetricSample => Boolean(sample));
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
