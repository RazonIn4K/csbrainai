# Go-Live Readiness Gate

## Overview

This checklist ensures the RAG system is production-ready with all security, privacy, and operational requirements met.

## Pre-Launch Checklist

### 🔐 Security

- [ ] **Environment Variables**
  - [ ] All secrets stored in secure secrets manager (not .env files)
  - [ ] `HASH_SALT` is 32+ character random string
  - [ ] `SUPABASE_SERVICE_ROLE` never exposed to client
  - [ ] `OPENAI_API_KEY` has spending limits configured
  - [ ] No secrets committed to git (check with `git log -S "sk-"`)

- [ ] **Security Headers**
  - [ ] Content-Security-Policy configured and tested
  - [ ] HSTS enabled (Strict-Transport-Security)
  - [ ] X-Frame-Options set to DENY
  - [ ] Test: https://securityheaders.com

- [ ] **Rate Limiting**
  - [ ] Rate limiter tested (10 req/min/IP)
  - [ ] 429 responses return correct `Retry-After` header
- [ ] Upstash Redis configured (fallback token bucket is dev-only)
  - [ ] Rate limit bypasses configured for monitoring/health checks

- [ ] **HTTPS**
  - [ ] SSL certificate valid and auto-renewing
  - [ ] HTTP redirects to HTTPS
  - [ ] HSTS header includes `includeSubDomains`
  - [ ] Test: https://www.ssllabs.com/ssltest/

### 🔒 Privacy

- [ ] **PII Protection**
  - [ ] Query hashing implemented and tested
  - [ ] No raw queries in Sentry (verify with test queries)
  - [ ] No raw queries in database (run SQL check)
  - [ ] No raw queries in application logs
  - [ ] `beforeSend` hooks tested with PII test data

- [ ] **Compliance**
  - [ ] Privacy policy published and linked
  - [ ] Data retention policy defined (default: 30 days)
  - [ ] User data deletion process documented
  - [ ] GDPR/CCPA requirements reviewed
  - [ ] Cookie consent banner (if applicable)

- [ ] **Third-Party Data**
  - [ ] OpenAI data retention policy reviewed
  - [ ] Supabase data residency verified
  - [ ] Sentry PII scrubbing tested
  - [ ] Data Processing Agreements (DPAs) signed

### 📊 Observability (Sentry L5 Tool)

- [ ] **Sentry Configuration**
  - [ ] `SENTRY_DSN` configured for production
  - [ ] Source maps uploaded (test error stack traces)
  - [ ] PII scrubbing verified
  - [ ] Alerts configured for critical errors
  - [ ] Team members added with appropriate permissions

- [ ] **Monitoring Dashboards**
  - [ ] Error rate dashboard
  - [ ] Performance metrics (p50, p95, p99)
  - [ ] Rate limit violations
  - [ ] OpenAI API errors

- [ ] **Alerting**
  - [ ] Critical error alerts → PagerDuty/Slack
  - [ ] High error rate alerts (>5% in 5min)
  - [ ] Performance degradation alerts (p95 > 5s)
  - [ ] Rate limit abuse alerts

### 🗄️ Database (Supabase)

- [ ] **Schema**
  - [ ] Migration `001_rag_schema.sql` applied
  - [ ] pgvector extension enabled
  - [ ] IVFFlat index created on `embedding` column
  - [ ] Row Level Security (RLS) policies enabled
  - [ ] Unique constraint on `chunk_hash` verified

- [ ] **Performance**
  - [ ] IVFFlat `lists` parameter tuned (sqrt(total_rows))
  - [ ] Query performance tested with 10k+ docs
  - [ ] Vector search latency < 100ms (p95)
  - [ ] Database connection pooling configured

- [ ] **Backups**
  - [ ] Automated daily backups enabled
  - [ ] Backup retention: 30 days minimum
  - [ ] Restore procedure tested
  - [ ] Point-in-time recovery enabled

- [ ] **Scaling**
  - [ ] Database size limits understood
  - [ ] Connection limits configured
  - [ ] Read replicas considered (if high traffic)

### 🤖 AI/ML

- [ ] **OpenAI**
  - [ ] Spending limits configured ($X/month)
  - [ ] Usage monitoring dashboard
  - [ ] Fallback strategy for API outages
  - [ ] Rate limit tier confirmed (e.g., tier 2 = 10k RPM)
  - [ ] Zero-retention policy opted into (if applicable)

- [ ] **Embeddings**
  - [ ] Model pinned (`text-embedding-3-small`)
  - [ ] Embedding dimension verified (1536)
  - [ ] Batch embedding for large ingests tested
  - [ ] Cost per 1M tokens documented ($0.02)

- [ ] **LLM**
  - [ ] Model pinned (`gpt-4o-mini`)
  - [ ] Temperature set (0.7)
  - [ ] Max tokens limit (500)
  - [ ] System prompt finalized and tested

### 📥 Ingestion

- [ ] **Data Preparation**
  - [ ] Knowledge files reviewed for quality
  - [ ] Sensitive data removed from knowledge base
  - [ ] Markdown formatting validated
  - [ ] Minimum 100 chunks ingested for testing

- [ ] **Ingestion Process**
  - [ ] Deduplication tested (re-run ingestion)
  - [ ] Error handling for malformed files
  - [ ] Progress logging for large ingests
  - [ ] Rollback strategy documented

- [ ] **Automation**
  - [ ] CI/CD pipeline for ingestion (optional)
  - [ ] Scheduled re-ingestion (if data updates regularly)
  - [ ] Monitoring for ingestion failures

### 🧪 Testing

- [ ] **Unit Tests**
  - [ ] PII scrubbing functions
  - [ ] Query hashing determinism
  - [ ] Chunking logic
  - [ ] Rate limiter

- [ ] **Integration Tests**
  - [ ] End-to-end answer flow
  - [ ] Database connection
  - [ ] OpenAI API integration
  - [ ] Sentry integration

- [ ] **Evaluation Suite**
  - [ ] Nightly evals workflow tested
  - [ ] 20 test questions in `test-questions.jsonl`
  - [ ] Quality threshold set (50%)
  - [ ] Evaluation artifacts uploaded

- [ ] **Load Testing**
  - [ ] 100 concurrent users simulated
  - [ ] Rate limiting holds under load
  - [ ] Database performance stable
  - [ ] No memory leaks after 1000 requests

### 🚀 Deployment

- [ ] **Infrastructure**
  - [ ] Production environment provisioned
  - [ ] Auto-scaling configured
  - [ ] Health check endpoint (`/api/health`)
  - [ ] Graceful shutdown implemented

- [ ] **CI/CD**
  - [ ] GitHub Actions workflows tested
  - [ ] Nightly evals passing
  - [ ] Build artifacts generated
  - [ ] Deployment rollback tested

- [ ] **DNS & CDN**
  - [ ] Domain configured (csbrainai.com)
  - [ ] CDN enabled (Vercel/Cloudflare)
  - [ ] DDoS protection enabled
  - [ ] Geographic routing (if applicable)

### 📚 Documentation

- [ ] **Technical Docs**
  - [ ] README.md complete with setup instructions
  - [ ] SCHEMA.md documents database structure
  - [ ] INGEST.md explains ingestion process
  - [ ] ANSWER-FLOW.md details API flow
  - [ ] PRIVACY.md outlines privacy measures
  - [ ] GO-LIVE-GATE.md (this document)

- [ ] **Operational Docs**
  - [ ] Runbook for common issues
  - [ ] Incident response plan
  - [ ] Escalation contacts
  - [ ] Monitoring dashboard URLs

- [ ] **User Docs**
  - [ ] API documentation published
  - [ ] Usage examples
  - [ ] Rate limit information
  - [ ] Privacy policy

### 🔄 Operational Readiness

- [ ] **On-Call**
  - [ ] On-call rotation defined
  - [ ] Pager/alert channels configured
  - [ ] Escalation policy documented
  - [ ] Runbooks accessible

- [ ] **Capacity Planning**
  - [ ] Expected traffic forecasted
  - [ ] Database size projections
  - [ ] OpenAI cost estimates
  - [ ] Scaling triggers defined

- [ ] **Disaster Recovery**
  - [ ] Backup restoration tested
  - [ ] Failover procedures documented
  - [ ] RTO (Recovery Time Objective): < 4 hours
  - [ ] RPO (Recovery Point Objective): < 1 hour

## Launch Decision

### Required for Launch

**MUST HAVE** (all checkboxes above):
- ✅ All security measures implemented
- ✅ PII protection verified
- ✅ Sentry monitoring configured
- ✅ Database schema deployed
- ✅ Rate limiting tested
- ✅ Ingestion working
- ✅ Evaluation suite passing

### Nice to Have (Post-Launch)

- [ ] Advanced analytics dashboard
- [ ] User feedback system
- [ ] A/B testing framework
- [ ] Multi-region deployment
- [ ] Advanced caching strategies

## Post-Launch

### Week 1

- [ ] Monitor error rates (target: < 1%)
- [ ] Verify rate limiting effectiveness
- [ ] Check Sentry for unexpected errors
- [ ] Review OpenAI usage and costs
- [ ] Collect user feedback

### Month 1

- [ ] Analyze evaluation metrics trends
- [ ] Optimize IVFFlat index if needed
- [ ] Review and update knowledge base
- [ ] Cost optimization review
- [ ] Security audit

### Quarterly

- [ ] Dependency updates (security patches)
- [ ] Penetration testing
- [ ] Privacy compliance audit
- [ ] Capacity planning review
- [ ] Disaster recovery drill

## Sign-Off

### Approval Required From

- [ ] **Engineering Lead**: Security & privacy measures verified
- [ ] **Product Manager**: Feature completeness confirmed
- [ ] **Security Team**: Penetration test passed
- [ ] **Legal**: Privacy policy approved
- [ ] **SRE**: Monitoring and alerting ready

---

**Launch Date**: ___________

**Approved By**: ___________

**Launch Coordinator**: ___________
