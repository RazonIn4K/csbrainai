import { NextRequest } from 'next/server';

import { GET } from '../app/api/admin/metrics/route';

jest.mock('../lib/metrics-store', () => ({
  getMetricsSummary: jest.fn(() => ({
    windowStart: '2026-06-10T00:00:00.000Z',
    windowEnd: '2026-06-10T01:00:00.000Z',
    totals: { requests: 1 },
    latency: {},
    retrieval: {},
    cost: {},
    recent: [],
  })),
}));

function buildRequest(authorization?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/metrics', {
    headers: authorization ? { authorization } : undefined,
  });
}

describe('/api/admin/metrics', () => {
  const originalToken = process.env.METRICS_ADMIN_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.METRICS_ADMIN_TOKEN;
    } else {
      process.env.METRICS_ADMIN_TOKEN = originalToken;
    }
  });

  it('returns 503 when METRICS_ADMIN_TOKEN is not configured', async () => {
    delete process.env.METRICS_ADMIN_TOKEN;

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Metrics not configured');
  });

  it('returns 401 when the bearer token is missing or wrong', async () => {
    process.env.METRICS_ADMIN_TOKEN = 'correct-token';

    const missing = await GET(buildRequest());
    expect(missing.status).toBe(401);

    const wrong = await GET(buildRequest('Bearer wrong-token'));
    expect(wrong.status).toBe(401);
  });

  it('returns the metrics summary with a valid bearer token', async () => {
    process.env.METRICS_ADMIN_TOKEN = 'correct-token';

    const response = await GET(buildRequest('Bearer correct-token'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totals).toEqual({ requests: 1 });
    expect(body.generatedAt).toEqual(expect.any(String));
  });
});
