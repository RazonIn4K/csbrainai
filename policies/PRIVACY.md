# Privacy Policy

**Effective Date:** 2025-11-06
**Last Updated:** 2025-11-06
**Version:** 1.0

---

## Overview

CSBrainAI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard information when you use our Retrieval Augmented Generation (RAG) service.

**Key Principle:** We never log or store raw query text. We only store anonymized metadata (hash + length) for analytics.

---

## Information We Collect

### 1. Query Metadata (Automatically Collected)

When you submit a question to our API, we collect:

| Data Point | Description | Purpose | Retention |
|------------|-------------|---------|-----------|
| **q_hash** | HMAC-SHA256 hash of your query | Usage analytics, debugging | 90 days |
| **q_len** | Character length of your query | Performance analysis | 90 days |
| **Timestamp** | When the query was submitted | Temporal analysis | 90 days |
| **Model** | LLM model used (e.g., gpt-4o-mini) | Performance tracking | 90 days |
| **Latency** | Response time in milliseconds | Performance monitoring | 90 days |

**What We DO NOT Collect:**
- ❌ Your query text (raw question)
- ❌ Generated answers
- ❌ User identifiers (name, email, username)
- ❌ IP addresses (beyond rate limiting, discarded after 60 seconds)
- ❌ Device information
- ❌ Cookies or tracking pixels

### 2. Error Data (Automatically Collected)

When an error occurs, we collect:
- Error type and stack trace
- Request URL (query parameters stripped)
- HTTP status code
- Timestamp

**PII Scrubbing:** All error data is scrubbed before transmission to Sentry (our error tracking service). We remove request bodies, headers, cookies, and user context.

### 3. Technical Data (Ephemeral)

**IP Address:**
- **Purpose:** Rate limiting (prevent abuse)
- **Retention:** Discarded after 60 seconds
- **Storage:** In-memory or Upstash Redis (encrypted in transit)
- **Not Logged:** IP addresses are not stored in Sentry or databases

---

## How We Use Information

### 1. Service Delivery
- Generate AI-powered answers to your questions
- Retrieve relevant information from our knowledge base
- Return citations and sources

### 2. Analytics (Privacy-Safe)
- **Usage Patterns:** Analyze query length distribution (e.g., "40% of queries are 50-100 chars")
- **Performance Optimization:** Identify slow queries by length (not content)
- **Capacity Planning:** Forecast infrastructure needs based on volume

**Example Analysis (Safe):**
```
Query Length Distribution:
0-50 chars:   40% (avg latency: 800ms)
51-100 chars: 50% (avg latency: 1200ms)
101+ chars:   10% (avg latency: 1800ms)
```

### 3. Security & Abuse Prevention
- **Rate Limiting:** Prevent API abuse (10 requests/min per IP)
- **DDoS Protection:** Block malicious traffic
- **Error Monitoring:** Detect and fix bugs

### 4. System Monitoring
- **Sentry:** Error tracking and performance monitoring
- **Alerts:** Notify engineers of outages or regressions
- **Compliance:** Verify PII scrubbing is working correctly

---

## Data Sharing

### Third-Party Services

We use the following third-party services that process data on our behalf:

#### 1. OpenAI (LLM Provider)
- **Data Shared:** Your query text, retrieved document chunks
- **Purpose:** Generate embeddings and answers
- **Privacy:** [OpenAI Data Usage Policy](https://openai.com/policies/usage-policies)
- **Retention:** OpenAI stores data for 30 days for abuse monitoring (then deleted)
- **Opt-Out:** OpenAI does not train models on API data by default

#### 2. Supabase (Database)
- **Data Shared:** Document embeddings, source URLs, content
- **Purpose:** Vector search for relevant documents
- **Privacy:** [Supabase Privacy Policy](https://supabase.com/privacy)
- **Retention:** Indefinite (until we delete documents)
- **Location:** Your chosen region (e.g., US East, EU West)

#### 3. Sentry (Error Tracking)
- **Data Shared:** Error metadata, query hash + length (NOT raw queries)
- **Purpose:** Debug errors and monitor performance
- **Privacy:** [Sentry Privacy Policy](https://sentry.io/privacy/)
- **Retention:** 90 days
- **PII Scrubbing:** Enabled (see Technical Measures below)

#### 4. Upstash (Rate Limiting - Optional)
- **Data Shared:** Hashed IP address, request timestamps
- **Purpose:** Distributed rate limiting
- **Privacy:** [Upstash Privacy Policy](https://upstash.com/privacy)
- **Retention:** 60 seconds (sliding window)
- **Location:** Closest edge region

**No Other Sharing:**
We do NOT sell, rent, or share your data with advertisers, marketers, or other third parties.

---

## Data Security

### Technical Measures

#### 1. Query Hashing
```typescript
// Pseudonymization (GDPR Article 4.5)
const q_hash = HMAC-SHA256(query, secret_salt);
// Original query is discarded, only hash stored
```

**Properties:**
- Irreversible: Cannot reconstruct query from hash
- Deterministic: Same query = same hash (for deduplication)
- Secret-keyed: Salt prevents rainbow table attacks

#### 2. PII Scrubbing (Sentry)
```typescript
// lib/sentry/server.ts
beforeSend(event) {
  delete event.request.data;     // Remove body (contains query)
  delete event.request.cookies;
  delete event.request.headers;
  delete event.user;             // Remove user context
  // Strip query params from URL
  event.request.url = event.request.url.split('?')[0];
  // Regex scrub exception messages (emails, phones, etc.)
  return event;
}
```

#### 3. Encryption
- **In Transit:** HTTPS/TLS 1.3 (all connections)
- **At Rest:** Supabase encrypts data at rest (AES-256)
- **Secrets:** Environment variables (not committed to git)

#### 4. Access Control
- **Database:** Supabase Row-Level Security (anon key = read-only)
- **Sentry:** Role-based access (developers = view, admin = manage)
- **API Keys:** Rotated every 90 days

---

## Your Rights

### GDPR (EU Residents)

You have the following rights under GDPR:

**1. Right to Access (Article 15):**
- Request: Email privacy@csbrainai.com with your query hash
- Response: We'll provide all stored metadata (q_hash, q_len, timestamp)
- Timeline: 30 days

**2. Right to Deletion (Article 17):**
- Request: Email privacy@csbrainai.com with your query hash
- Action: We'll delete associated Sentry events
- Timeline: 7 days
- Note: Since we don't store raw queries, there's minimal data to delete

**3. Right to Rectification (Article 16):**
- Not applicable (we don't store personal information)

**4. Right to Data Portability (Article 20):**
- Format: JSON export of metadata (q_hash, q_len, timestamps)
- Request: Email privacy@csbrainai.com

**5. Right to Object (Article 21):**
- You can stop using our service at any time
- Data automatically deleted after 90 days

### CCPA (California Residents)

You have the following rights under CCPA:

**1. Right to Know:**
- What personal information we collect (see "Information We Collect")
- Request: Email privacy@csbrainai.com

**2. Right to Delete:**
- Same as GDPR Right to Deletion

**3. Right to Opt-Out of Sale:**
- We do NOT sell personal information

**4. Right to Non-Discrimination:**
- We will not discriminate for exercising your rights

---

## Data Retention

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Query hash (q_hash) | 90 days | Analytics, debugging |
| Query length (q_len) | 90 days | Performance analysis |
| Sentry events | 90 days | Error tracking |
| Rate limit state | 60 seconds | Abuse prevention |
| Document embeddings | Indefinite | Knowledge base (until manual deletion) |

**Automatic Deletion:**
- Sentry events auto-delete after 90 days
- Rate limit data expires after 60 seconds
- No manual intervention required

---

## Children's Privacy

CSBrainAI is not directed at children under 13 (or 16 in the EU). We do not knowingly collect information from children. If you believe we have collected data from a child, contact privacy@csbrainai.com.

---

## International Data Transfers

**Data Locations:**
- **Supabase:** Your chosen region (US East, EU West, etc.)
- **OpenAI:** US-based servers
- **Sentry:** US-based servers

**EU-US Transfers:**
- OpenAI: [Data Processing Addendum](https://openai.com/policies/data-processing-addendum)
- Sentry: EU Cloud available (opt-in)
- Supabase: EU region available

**Standard Contractual Clauses (SCCs):**
We execute SCCs with all third-party processors per GDPR Article 46.

---

## Changes to This Policy

We may update this Privacy Policy to reflect:
- New features or services
- Legal or regulatory changes
- Community feedback

**Notification:**
- Major changes: Email notification (if we have your email)
- Minor changes: Updated "Last Updated" date at top
- Archive: Previous versions available at `/policies/PRIVACY-archive/`

---

## Contact Us

**Privacy Inquiries:**
- Email: privacy@csbrainai.com
- Response Time: 3 business days
- Mailing Address: [Your address]

**Data Protection Officer (DPO):**
- Email: dpo@csbrainai.com
- Available for EU residents

**Supervisory Authority (EU):**
If you're unsatisfied with our response, you can contact your local data protection authority:
- [List of EU DPAs](https://edpb.europa.eu/about-edpb/board/members_en)

---

## Transparency Report

We publish a quarterly transparency report with:
- Number of data access requests
- Number of deletion requests
- Average response time
- PII audit results (monthly check for scrubbing effectiveness)

**Latest Report:** [Link to Q4 2024 report]

---

## Commitment to Privacy

**Our Pledge:**
- We will NEVER sell your data
- We will NEVER log raw queries
- We will ALWAYS scrub PII before external transmission
- We will ALWAYS respect your rights (GDPR, CCPA, etc.)

**Verification:**
- Monthly PII audits (random sample of 100 Sentry events)
- Quarterly penetration testing (security + privacy)
- Annual third-party privacy assessment

---

## Acknowledgments

This Privacy Policy is inspired by:
- [GDPR Requirements](https://gdpr.eu/)
- [CCPA Compliance Guide](https://oag.ca.gov/privacy/ccpa)
- [Mozilla Privacy Principles](https://www.mozilla.org/privacy/principles/)

---

**Last Reviewed:** 2025-11-06
**Next Review:** 2025-12-06 (monthly)
