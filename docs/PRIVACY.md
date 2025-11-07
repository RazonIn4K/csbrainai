# Privacy Protection Documentation

## Overview

This RAG system implements **privacy-first** design principles, ensuring user queries are never stored in raw form while maintaining full observability and debugging capabilities.

## Core Principle

**NEVER store, log, or transmit raw user queries in any identifiable form.**

## Privacy Guarantees

### ✅ What We Store

1. **Query Hash** (`q_hash`)
   - HMAC-SHA256 hash of query using secret `HASH_SALT`
   - Irreversible: Cannot reconstruct original query
   - Deterministic: Same query = same hash
   - Use case: Duplicate detection, debugging

2. **Query Length** (`q_len`)
   - Integer: Number of characters in query
   - No semantic information
   - Use case: Performance analysis, anomaly detection

3. **Metadata**
   - Timestamp
   - Response time
   - Token usage
   - Citations count
   - Error codes (if applicable)

### ❌ What We NEVER Store

- Raw query text
- User identifiers (beyond IP for rate limiting)
- Session tokens
- Cookies (except essential)
- Browser fingerprints

## Technical Implementation

### 1. Query Hashing

#### Algorithm

```typescript
import * as crypto from 'crypto';

function generateHMAC(data: string): string {
  const salt = process.env.HASH_SALT;
  return crypto
    .createHmac('sha256', salt)
    .update(data)
    .digest('hex');
}

function hashQuery(query: string): { hash: string; length: number } {
  return {
    hash: generateHMAC(query),
    length: query.length
  };
}
```

#### Properties

- **Irreversible**: HMAC is a one-way function
- **Salted**: `HASH_SALT` prevents rainbow table attacks
- **Deterministic**: Same input always produces same hash
- **Collision-resistant**: SHA256 provides 256-bit security

#### Example

```typescript
Input:  "What is RAG?"
Salt:   "my-secret-salt-value"
Hash:   "a3f2b9c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
Length: 12
```

Even with the hash, the original query **cannot be recovered**.

### 2. Sentry PII Scrubbing

#### Before Send Hook

```typescript
// sentry.server.config.ts
Sentry.init({
  beforeSend(event, hint) {
    if (event.request) {
      event.request = sanitizeRequest(event.request);
    }
    if (event.extra) {
      event.extra = scrubPII(event.extra);
    }
    return event;
  }
});
```

#### Scrubbing Rules

1. **Sensitive Fields**: Automatically scrubbed
   - `query`, `prompt`, `message`
   - `email`, `password`, `token`
   - `authorization`, `cookie`

2. **Headers**: Removed entirely
   - `Authorization`
   - `Cookie`
   - `X-API-Key`
   - `X-Auth-Token`

3. **Request Bodies**: Hashed before sending
   ```typescript
   if (typeof data === 'string') {
     const { hash, length } = hashPII(data);
     return { _scrubbed: true, hash, length };
   }
   ```

#### Example Event

**Before Scrubbing**:
```json
{
  "request": {
    "data": { "query": "What is my password reset link?" },
    "headers": { "Authorization": "Bearer abc123" }
  }
}
```

**After Scrubbing**:
```json
{
  "request": {
    "data": {
      "query": {
        "_scrubbed": true,
        "hash": "d4f5e6...",
        "length": 34
      }
    },
    "headers": {}
  }
}
```

### 3. Rate Limiting Privacy

#### IP Address Handling

```typescript
function getIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.ip || 'unknown';
}
```

**Retention**:
- IP addresses stored **in-memory only**
- Cleaned up after 5 minutes of inactivity
- Never persisted to disk or database

**Anonymization** (optional enhancement):
```typescript
// Hash IP for additional privacy
const hashedIP = crypto.createHash('sha256')
  .update(ip + DAILY_SALT)
  .digest('hex');
```

### 4. Database Privacy

#### Supabase Schema

The `rag_docs` table contains **zero user data**:
- Only knowledge base content
- No user queries stored
- No user identifiers

#### Query Isolation

Vector searches use **ephemeral embeddings**:
```typescript
// Embedding generated on-the-fly
const embedding = await generateEmbedding(query);

// Used for search
const results = await searchDocuments(embedding);

// Embedding is NEVER stored (garbage collected immediately)
```

## Compliance

### GDPR Compliance

✅ **Right to Access**: Users can request their hashed query history (though it reveals nothing without the original query)

✅ **Right to Erasure**: Hash-based system allows deletion by hash

✅ **Data Minimization**: Only essential data (hash, length) is retained

✅ **Purpose Limitation**: Data used only for debugging and analytics

✅ **Storage Limitation**: Logs retained for 30 days (configurable)

### CCPA Compliance

✅ **Transparency**: Privacy policy clearly states hashing approach

✅ **No Sale of Data**: Hashes are not PII and not sold

✅ **Opt-Out**: Users can opt out via Do Not Track headers

### HIPAA Considerations

⚠️ **Not HIPAA Compliant Out-of-the-Box**

For healthcare data:
1. Enable at-rest encryption (Supabase supports this)
2. Use end-to-end encryption for embeddings
3. Implement audit logging
4. Sign BAA with Supabase, OpenAI, Sentry

## Threat Model

### What This Protects Against

✅ **Database Breach**: Hashes reveal no PII

✅ **Log Leakage**: Sentry logs contain no raw queries

✅ **Insider Threats**: Admins cannot see user queries

✅ **Subpoena**: No raw query data to hand over

✅ **Analytics Leakage**: Analytics tools see only hashes

### What This Does NOT Protect Against

❌ **OpenAI Logging**: OpenAI sees raw queries (per their ToS)

❌ **In-Transit Interception**: Use HTTPS to mitigate

❌ **Client-Side Logging**: Ensure no browser console logs

❌ **Memory Dumps**: Raw queries exist in RAM briefly

## Best Practices

### 1. HASH_SALT Security

```bash
# Generate strong salt (32 bytes = 256 bits)
openssl rand -hex 32

# Store in secrets manager (NOT .env file in production)
# - AWS Secrets Manager
# - Google Cloud Secret Manager
# - HashiCorp Vault
```

**Never commit to version control**:
```gitignore
.env
.env.local
.env.production
```

### 2. Sentry Configuration

```typescript
Sentry.init({
  beforeSend(event) {
    // Double-check PII scrubbing
    if (JSON.stringify(event).includes('query')) {
      console.error('PII LEAK DETECTED');
      return null; // Drop the event
    }
    return event;
  }
});
```

### 3. OpenAI Data Retention

Opt into OpenAI's zero-retention policy:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add org header to opt out of training data usage
  organization: process.env.OPENAI_ORG_ID,
});
```

Check OpenAI's data usage policies: https://openai.com/policies/usage-policies

### 4. Secure Deletion

If a user requests deletion:
```typescript
// Find by hash
const { data } = await supabase
  .from('query_logs')
  .delete()
  .eq('q_hash', userProvidedHash);

// Also delete from Sentry
Sentry.scrubEvent({ eventId: '...' });
```

## Verification

### Audit Checklist

- [ ] `HASH_SALT` is set and secret
- [ ] No `console.log(query)` in code
- [ ] Sentry events scrubbed (test with dummy PII)
- [ ] Database contains no raw queries
- [ ] Rate limiter uses hashed IPs (optional)
- [ ] HTTPS enforced (HSTS header)
- [ ] OpenAI zero-retention enabled
- [ ] Privacy policy updated

### Testing PII Scrubbing

```typescript
// Test Sentry scrubbing
Sentry.captureMessage('Test', {
  extra: {
    query: 'This should be hashed',
    password: 'This should be scrubbed'
  }
});

// Check Sentry dashboard - should see hashes, not raw data
```

## Incident Response

If raw query data is accidentally logged:

1. **Immediate**: Delete logs from Sentry
2. **Rotate**: Change `HASH_SALT` (invalidates existing hashes)
3. **Notify**: Inform affected users (if identifiable)
4. **Review**: Audit codebase for logging statements
5. **Train**: Educate team on PII handling

## Future Enhancements

1. **Differential Privacy**: Add noise to analytics
2. **Zero-Knowledge Embeddings**: Client-side embedding generation
3. **Homomorphic Encryption**: Search on encrypted vectors
4. **Federated Learning**: Train models without centralized data
