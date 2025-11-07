# Security and Privacy Architecture

This RAG system implements enterprise-grade security and privacy protections.

## Privacy-First Logging

The system follows a strict no-PII policy:
- User queries are NEVER stored in raw form
- Only HMAC-SHA256 hashes and lengths are logged
- The HASH_SALT environment variable must be kept secret
- Even administrators cannot reconstruct original queries from logs

### Query Hashing Implementation
```
q_hash = HMAC-SHA256(query, HASH_SALT)
q_len = length(query)
```

This allows debugging and analytics while protecting user privacy.

## Sentry Integration

Sentry is the L5 observability tool with PII scrubbing:
- All sensitive fields are automatically scrubbed before sending to Sentry
- Custom `beforeSend` hooks prevent accidental PII leakage
- Sensitive headers (Authorization, Cookie, etc.) are removed
- Request bodies are sanitized using the hashPII utility

## Rate Limiting

API endpoints are protected with multi-tier rate limiting:
- Primary: Upstash Redis-based sliding window (optional)
- Fallback: In-memory token bucket algorithm
- Limit: 10 requests per minute per IP address
- Returns 429 status code when exceeded

## Security Headers

The middleware implements comprehensive security headers:
- Content-Security-Policy (CSP) prevents XSS attacks
- X-Frame-Options: DENY prevents clickjacking
- Strict-Transport-Security enforces HTTPS
- X-Content-Type-Options prevents MIME sniffing
- Referrer-Policy controls referrer information leakage

## Database Security

Supabase Row Level Security (RLS) policies:
- Service role has full access (for ingestion only)
- Public users have read-only access
- Vector search operations are read-only by default
