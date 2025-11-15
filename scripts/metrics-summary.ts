#!/usr/bin/env tsx
import { getMetricsLogPath, readPersistedMetrics } from '../lib/metrics-store';

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function formatMs(value: number) {
  return `${value.toFixed(1)} ms`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`;
}

async function main() {
  const samples = await readPersistedMetrics(100);

  if (samples.length === 0) {
    console.log('No recorded RAG metrics yet. Hit /api/answer or run finance/policy demos to populate.');
    console.log(`Log path checked: ${getMetricsLogPath()}`);
    process.exit(0);
  }

  const successCount = samples.filter((sample) => sample.success).length;
  const errorCount = samples.length - successCount;
  const avgLatency = average(samples.map((sample) => sample.endToEndMs));
  const vectorLatencies = samples
    .map((sample) => sample.vectorSearchMs)
    .filter((value): value is number => typeof value === 'number');
  const avgVector = average(vectorLatencies);
  const chunkCounts = samples
    .map((sample) => sample.chunksReturned)
    .filter((value): value is number => typeof value === 'number');
  const avgChunks = average(chunkCounts);
  const costValues = samples
    .map((sample) => sample.costUsd)
    .filter((value): value is number => typeof value === 'number');
  const avgCost = average(costValues);

  console.log('💹  RAG Performance Summary (last', samples.length, 'requests)');
  console.log('──────────────────────────────────────────────────────');
  console.log(' Avg end-to-end latency :', formatMs(avgLatency));
  console.log(' Avg vector search time :', vectorLatencies.length ? formatMs(avgVector) : 'n/a');
  console.log(' Avg chunks retrieved   :', avgChunks.toFixed(1));
  console.log(' Avg cost per query     :', costValues.length ? formatUsd(avgCost) : 'n/a');
  console.log(' Success count          :', successCount);
  console.log(' Error count            :', errorCount);
  console.log(' Error rate             :', formatPercent(errorCount / samples.length));
  console.log(' Log path               :', getMetricsLogPath());
}

main().catch((error) => {
  console.error('Failed to load metrics summary:', error);
  process.exit(1);
});
