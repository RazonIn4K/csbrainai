# Go-Live Gate Checklist

**Status:** Pre-Production
**Last Updated:** 2025-11-06
**Owner:** Senior Staff Engineer

---

## Overview

This document defines the mandatory requirements that MUST be met before CSBrainAI can be deployed to production. All items must be verified and signed off by the appropriate stakeholders.

## Pre-Launch Requirements

### 1. Security ✅

- [ ] **Security headers implemented**
  - CSP, X-Frame-Options, X-Content-Type-Options, etc.
  - Verified via middleware.ts
  - Test: `curl -I https://csbrainai.com` should show all headers

- [ ] **Rate limiting active**
  - Upstash Redis configured (or fallback token bucket)
  - Test: Send 11 requests in 60s, 11th should return 429
  - Monitoring: Track rate limit violations in Sentry

- [ ] **PII scrubbing verified**
  - Sentry dashboard shows ZERO raw queries
  - Only q_hash and q_len in breadcrumbs
  - Test: Trigger error with sensitive query, verify Sentry event

- [ ] **Environment secrets secured**
  - All secrets in environment variables (NOT committed to git)
  - Vercel/hosting platform secrets configured
  - HASH_SALT is random 32-byte hex (NOT default)

- [ ] **HTTPS enforced**
  - SSL certificate valid
  - HSTS header present
  - HTTP redirects to HTTPS

- [ ] **SQL injection prevention**
  - Supabase client uses parameterized queries
  - No raw SQL string concatenation
  - Vector search uses RPC or prepared statements

### 2. Privacy & Compliance ✅

- [ ] **Privacy policy published**
  - PRIVACY.md accessible at /policies/PRIVACY.md
  - Explains PII handling and data retention
  - Reviewed by legal counsel

- [ ] **Data residency confirmed**
  - Supabase region matches compliance requirements (e.g., US, EU)
  - OpenAI data processing agreement signed
  - No data stored in unsupported regions

- [ ] **User consent mechanism (if applicable)**
  - If collecting user data beyond queries, consent banner required
  - Cookie policy if using tracking cookies

- [ ] **Data deletion process**
  - Documented procedure for deleting user data on request
  - Supabase query: `DELETE FROM rag_docs WHERE ...`

### 3. Performance & Reliability ✅

- [ ] **Load testing completed**
  - Test: 100 req/s for 5 minutes
  - Verify: <2s p95 latency, <1% error rate
  - Tool: k6, Locust, or Artillery

- [ ] **Database performance validated**
  - IVFFlat index created on rag_docs.embedding
  - Test: Vector search <100ms for 10k documents
  - Monitoring: pg_stat_statements enabled

- [ ] **Error handling tested**
  - Graceful degradation on OpenAI API failures
  - Retry logic for transient errors
  - Fallback responses for empty search results

- [ ] **Monitoring & alerting configured**
  - Sentry error tracking active
  - Alerts for:
    - Error rate >5% (15min window)
    - Latency p95 >3s (15min window)
    - Rate limit violations >100/hour

- [ ] **Backup & recovery plan**
  - Supabase automated backups enabled
  - Tested: Restore from backup
  - RPO: <24 hours, RTO: <1 hour

### 4. Documentation ✅

- [ ] **User documentation complete**
  - Getting started guide (data/getting-started.md)
  - API reference (data/api-reference.md)
  - FAQ (data/faq.txt)

- [ ] **Architecture documented**
  - ARCHITECTURE.md complete
  - System diagrams included
  - Data flow documented

- [ ] **Runbook created**
  - Incident response procedures
  - Common issues & troubleshooting
  - Escalation paths

- [ ] **SECURITY.md published**
  - Vulnerability disclosure process
  - Security best practices
  - Contact information

### 5. Testing ✅

- [ ] **Type checks pass**
  - `npm run type-check` → 0 errors
  - CI pipeline green

- [ ] **Linting passes**
  - `npm run lint` → 0 errors
  - ESLint rules enforced

- [ ] **End-to-end test**
  - Ingest sample data: `npm run ingest`
  - Query API: `curl -X POST .../api/answer -d '{"query":"test"}'`
  - Verify: Valid response with citations

- [ ] **Nightly evals passing**
  - 20-question eval suite runs successfully
  - Pass rate >80%
  - Results artifact uploaded

- [ ] **SBOM generated**
  - Software Bill of Materials created
  - Security vulnerabilities scanned
  - Critical CVEs resolved

### 6. Operational Readiness ✅

- [ ] **On-call rotation defined**
  - Primary and secondary on-call engineers
  - PagerDuty/Opsgenie configured
  - Escalation policy documented

- [ ] **Cost budget approved**
  - OpenAI API budget: $XXX/month
  - Supabase tier: Free/Pro/Enterprise
  - Infrastructure cost estimate

- [ ] **Capacity planning done**
  - Expected traffic: XXX req/day
  - Database size: XXX MB (XXX documents)
  - Scaling plan for 10x growth

- [ ] **Feature flags configured (optional)**
  - Ability to disable features without deployment
  - Gradual rollout capability

### 7. Legal & Compliance ✅

- [ ] **Terms of Service published (if applicable)**
  - TOS.md document
  - Covers liability, acceptable use, etc.

- [ ] **GDPR/CCPA compliance**
  - Right to deletion implemented
  - Data export capability
  - Privacy policy compliant

- [ ] **Third-party agreements signed**
  - OpenAI data processing agreement
  - Supabase terms accepted
  - Sentry terms accepted

- [ ] **Intellectual property cleared**
  - Training data license verified
  - No copyrighted content without permission
  - User-generated content policy

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Senior Staff Engineer | ___________ | ______ | ⬜ |
| Security Lead | ___________ | ______ | ⬜ |
| Legal Counsel | ___________ | ______ | ⬜ |
| Product Manager | ___________ | ______ | ⬜ |
| SRE Lead | ___________ | ______ | ⬜ |

---

## Go-Live Decision

**Final Approval:**
- [ ] All critical items checked
- [ ] Risk assessment completed
- [ ] Rollback plan documented

**Launch Date:** __________

**Signed:** ___________________________

---

## Post-Launch Monitoring (First 48 Hours)

- [ ] Monitor Sentry for errors
- [ ] Track latency metrics (p50, p95, p99)
- [ ] Review rate limit logs
- [ ] Check nightly eval results
- [ ] Verify PII scrubbing in production
- [ ] Monitor OpenAI API costs
- [ ] Review user feedback

---

## Rollback Criteria

Trigger immediate rollback if:
- Error rate >10% for 15 minutes
- Latency p95 >5s for 15 minutes
- PII leak detected in Sentry
- Security breach confirmed
- Data corruption in Supabase

**Rollback Procedure:**
1. Revert to previous Vercel deployment
2. Notify team via Slack/PagerDuty
3. Post-mortem within 24 hours
