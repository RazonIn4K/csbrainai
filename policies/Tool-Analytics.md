# Tool Analytics Strategy

**Level:** L5 (Sentry Integration)
**Last Updated:** 2025-11-06
**Owner:** Senior Staff Engineer

---

## Overview

CSBrainAI uses Sentry as the primary observability tool (L5) for error tracking, performance monitoring, and usage analytics. This document defines what we track, how we track it, and our privacy commitments.

## Observability Stack

### Primary: Sentry (L5)
- **Error Tracking:** Capture exceptions across client and server
- **Performance Monitoring:** Track API latency, database queries, OpenAI calls
- **Breadcrumbs:** Audit trail for debugging (PII-scrubbed)
- **Custom Events:** Query metrics, rate limit violations

### Supplementary Tools
- **Vercel Analytics:** Basic traffic metrics (if deployed on Vercel)
- **Supabase Logs:** Database query performance
- **OpenAI Dashboard:** API usage and costs

---

## What We Track

### 1. Query Metadata (PII-SAFE) ✅

**Stored in Sentry:**
```javascript
{
  q_hash: "a3f5e8b2...",  // HMAC-SHA256 hash
  q_len: 42,              // Query length
  model: "gpt-4o-mini",   // LLM model used
  latency_ms: 1250,       // End-to-end latency
  result_count: 5         // Number of citations
}
```

**NOT Stored:**
- Raw query text ❌
- User identifiers (email, IP, etc.) ❌
- Generated answers ❌
- Document content ❌

### 2. Error Events

**Captured:**
- Exception type and stack trace
- Request URL (query params stripped)
- HTTP method and status code
- Timestamp

**Scrubbed:**
- Request body (contains raw query)
- Headers (may contain auth tokens)
- Cookies
- User context

### 3. Performance Metrics

**Traces:**
- API endpoint latency (`/api/answer`)
- OpenAI embedding generation time
- Vector search duration
- LLM completion time

**Database:**
- Supabase query latency (via pg_stat_statements)
- pgvector index performance

### 4. System Health

**Monitored:**
- Error rate (per hour, per endpoint)
- Rate limit violations
- OpenAI API failures
- Database connection pool status

---

## Privacy Guarantees

### Zero PII Logging Commitment

1. **Query Text:** Never logged, stored, or transmitted to Sentry
2. **User Identity:** No user IDs, emails, or IP addresses in Sentry
3. **Generated Content:** Answers not logged (only success/failure)

### PII Scrubbing Implementation

**Client-Side (lib/sentry/client.ts):**
```typescript
beforeSend(event, hint) {
  delete event.request.data;     // Strip request body
  delete event.request.cookies;  // Strip cookies
  delete event.user;             // Strip user context
  // Strip query params from URL
  event.request.url = event.request.url?.split('?')[0];
  return event;
}
```

**Server-Side (lib/sentry/server.ts):**
```typescript
beforeSend(event, hint) {
  delete event.request.data;
  delete event.request.cookies;
  delete event.request.headers;
  // Scrub exception messages
  event.exception.values = event.exception.values.map(e => ({
    ...e,
    value: scrubSensitiveData(e.value) // Regex-based scrubbing
  }));
  return event;
}
```

### Audit Process

**Monthly PII Audit:**
1. Review 100 random Sentry events
2. Verify zero raw queries in breadcrumbs
3. Check for email/phone patterns in exception messages
4. Document findings in audit log

---

## Metrics & Dashboards

### Sentry Dashboard: "RAG System Health"

**Widgets:**
1. **Error Rate:** Errors/hour (target: <10/hour)
2. **API Latency:** p50, p95, p99 (target: p95 <2s)
3. **Query Volume:** Queries/hour by q_len histogram
4. **Rate Limit Hits:** Violations/hour (target: <5/hour)

### Custom Sentry Queries

**Top 10 Longest Queries (by length, not content):**
```javascript
// Sentry Discover query
q_len > 500 ORDER BY q_len DESC LIMIT 10
```

**High Latency Queries:**
```javascript
latency_ms > 3000 ORDER BY latency_ms DESC
```

**Zero-Result Queries (no citations found):**
```javascript
result_count = 0
```

---

## Alerting Rules

### Critical Alerts (PagerDuty)

1. **High Error Rate**
   - Condition: >5% error rate for 15 minutes
   - Action: Page on-call engineer
   - Response: Investigate root cause, consider rollback

2. **API Down**
   - Condition: 100% error rate for 5 minutes
   - Action: Page on-call + incident commander
   - Response: Emergency rollback

3. **PII Leak Detected**
   - Condition: Manual report or audit finding
   - Action: Page security team + CTO
   - Response: Immediate investigation, notify legal

### Warning Alerts (Slack)

1. **Elevated Latency**
   - Condition: p95 >3s for 15 minutes
   - Action: Post to #eng-alerts channel
   - Response: Investigate OpenAI/Supabase performance

2. **Rate Limit Spikes**
   - Condition: >100 violations/hour
   - Action: Post to #eng-alerts
   - Response: Check for abuse, adjust limits if needed

3. **Eval Regression**
   - Condition: Nightly evals pass rate <80%
   - Action: Post to #eng-alerts
   - Response: Review failed questions, investigate model changes

---

## Usage Analytics

### Query Patterns (PII-Safe)

**Length Distribution:**
```
Histogram of q_len:
0-50 chars:   ████████ 40%
51-100:       ████████████ 60%
101-200:      ██ 10%
200+:         ░ 2%
```

**Temporal Patterns:**
- Peak hours: 9 AM - 5 PM (workday traffic)
- Weekend vs weekday comparison
- Seasonal trends

**Performance by Query Length:**
```
q_len < 50:   avg latency 800ms
q_len 50-100: avg latency 1200ms
q_len 100+:   avg latency 1800ms
```

### System Performance Trends

**Weekly Report:**
- Total queries processed
- Average latency (p50, p95)
- Error rate
- Top 5 error types
- Cost per query (OpenAI API)

---

## Cost Tracking

### OpenAI API Costs

**Per Query Breakdown:**
- Embedding: ~$0.00001 (text-embedding-3-small)
- Chat: ~$0.0001 (gpt-4o-mini, 500 tokens output)
- **Total:** ~$0.00011 per query

**Monthly Projection:**
```
10,000 queries/month → $1.10
100,000 queries/month → $11.00
1,000,000 queries/month → $110.00
```

**Monitoring:**
- Track daily spend in OpenAI dashboard
- Alert if spend >$50/day (unexpected spike)

### Infrastructure Costs

- **Supabase:** $0 (Free tier) or $25/month (Pro)
- **Vercel:** $0 (Hobby) or $20/month (Pro)
- **Sentry:** $0 (Developer) or $26/month (Team)
- **Upstash Redis:** $0 (Free tier, 10k requests/day)

---

## Compliance & Retention

### Data Retention

**Sentry Events:**
- Retention: 90 days (configurable)
- After 90 days: Auto-deleted
- Compliance: GDPR Article 17 (right to erasure)

**Nightly Eval Results:**
- Retention: 90 days (GitHub artifacts)
- Purpose: Regression analysis
- Contains: NO PII (only test questions)

### GDPR Compliance

**Right to Access:**
- Users cannot access raw query data (we don't store it)
- Can provide: q_hash, q_len, timestamp

**Right to Deletion:**
- No user data to delete (queries not stored)
- Can delete: Sentry events by q_hash (if requested)

**Data Processing Agreement:**
- Sentry: [sentry.io/legal/dpa]
- OpenAI: [openai.com/policies/data-processing-addendum]

---

## Security & Access Control

### Sentry Access Levels

| Role | Permissions |
|------|-------------|
| Admin | Full access, settings, integrations |
| Developer | View events, search, dashboards |
| Support | View events (read-only) |
| External | No access |

### API Keys

- **Sentry DSN:** Public (safe to expose in client)
- **Sentry Auth Token:** Secret (for API access)
- **Rotation:** Every 90 days

---

## Future Enhancements (Out of Scope)

- [ ] A/B testing framework (track model performance)
- [ ] User feedback loop (thumbs up/down)
- [ ] Query clustering (group similar q_hash patterns)
- [ ] Anomaly detection (ML-based alerts)
- [ ] Cost optimization (cache embeddings for common queries)

---

## References

- [Sentry PII Scrubbing Docs](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/)
- [GDPR Article 17 (Right to Erasure)](https://gdpr-info.eu/art-17-gdpr/)
- [OpenAI Data Processing Addendum](https://openai.com/policies/data-processing-addendum)
