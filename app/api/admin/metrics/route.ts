import { NextRequest, NextResponse } from 'next/server';
import { getMetricsSummary } from '@/lib/metrics-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest, token: string): boolean {
  const headerValue = request.headers.get('authorization');
  if (!headerValue) {
    return false;
  }

  const expectedHeader = `Bearer ${token}`;
  return headerValue === expectedHeader;
}

export async function GET(request: NextRequest) {
  // Fail closed: without a configured token this endpoint must not be public
  const token = process.env.METRICS_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Metrics not configured', message: 'METRICS_ADMIN_TOKEN is not set' },
      { status: 503 }
    );
  }

  if (!isAuthorized(request, token)) {
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
