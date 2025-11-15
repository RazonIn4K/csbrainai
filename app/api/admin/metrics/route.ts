import { NextRequest, NextResponse } from 'next/server';
import { getMetricsSummary } from '@/lib/metrics-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.METRICS_ADMIN_TOKEN;
  if (!token) {
    return true;
  }

  const headerValue = request.headers.get('authorization');
  if (!headerValue) {
    return false;
  }

  const expectedHeader = `Bearer ${token}`;
  return headerValue === expectedHeader;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = getMetricsSummary();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowStart: summary.windowStart,
    windowEnd: summary.windowEnd,
    totals: summary.totals,
    latency: summary.latency,
    retrieval: summary.retrieval,
    cost: summary.cost,
    recent: summary.recent,
  });
}
