import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Model - CSBrainAI',
  description:
    'What gets logged (HMAC-SHA256 query hash, length, latency, tokens) vs what is never stored (raw queries, PII, sessions) — and the threat model behind it.',
};

const stored = [
  ['Query hash', 'Salted HMAC-SHA256 of the query (q_hash) — irreversible, deterministic'],
  ['Query length', 'Character count only (q_len) — no semantic information'],
  ['Latency', 'End-to-end and vector-search timings'],
  ['Token usage', 'Embedding + generation tokens, estimated cost'],
  ['Citation count', 'How many chunks backed the answer'],
  ['Error codes', 'Failure class, never failure payloads'],
] as const;

const neverStored = [
  ['Raw queries', 'Question text is hashed before anything else touches it'],
  ['User identifiers', 'No accounts, no sessions, no fingerprints'],
  ['IP addresses', 'Used in-memory for rate limiting only, evicted after minutes'],
  ['Cookies', 'None beyond what the platform strictly requires'],
  ['Query embeddings', 'Generated per request, used for search, then discarded'],
] as const;

export default function PrivacyModelPage() {
  return (
    <main className="site-shell">
      <header className="page-intro">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <span>Trust console</span>
        </nav>
        <p className="eyebrow">Trust console · Privacy model</p>
        <h1>The query you ask is never written down.</h1>
        <p className="hero-lede">
          Telemetry keeps a salted HMAC-SHA256 hash and a character count — enough to debug,
          rate-limit, and measure quality, and nothing that can reconstruct the question. This page
          summarizes <code>docs/PRIVACY.md</code>, which is the source of truth.
        </p>
      </header>

      <section className="lane-facts" aria-label="Stored versus never stored">
        <aside className="system-card" aria-label="What gets stored">
          <div className="system-card-header">
            <span className="status-dot" aria-hidden="true" />
            <span>Stored per query</span>
          </div>
          <dl className="system-list">
            {stored.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
        <aside className="system-card" aria-label="What is never stored">
          <div className="system-card-header">
            <span className="status-dot status-dot-danger" aria-hidden="true" />
            <span>Never stored</span>
          </div>
          <dl className="system-list">
            {neverStored.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="safeguards-band" aria-labelledby="privacy-enforcement">
        <div>
          <p className="eyebrow">Enforcement</p>
          <h2 id="privacy-enforcement">Where the guarantees are implemented</h2>
        </div>
        <ul>
          <li>
            Hashing: lib/crypto-utils.ts — HMAC-SHA256 with a secret HASH_SALT; same query, same
            hash; no way back to the text.
          </li>
          <li>
            Error reporting: lib/sentry-utils.ts — every Sentry event passes a beforeSend hook that
            scrubs sensitive fields (query, prompt, email, token…), strips auth headers and
            cookies, and replaces request bodies with hash + length.
          </li>
          <li>
            Rate limiting: lib/rate-limiter.ts — token bucket, 10 requests/min per IP; identifiers
            live in memory only and are cleaned up after inactivity.
          </li>
          <li>
            Database: the rag_docs table holds knowledge chunks only — zero user data, zero query
            logs; search embeddings are ephemeral.
          </li>
        </ul>
      </section>

      <section className="safeguards-band" aria-labelledby="privacy-threats">
        <div>
          <p className="eyebrow">Threat model</p>
          <h2 id="privacy-threats">What this protects against — and what it cannot</h2>
          <p className="band-note">
            Protected: database breach, log leakage, insider access, subpoena, analytics leakage —
            in every case there is no raw query to expose.
          </p>
        </div>
        <ul>
          <li>
            OpenAI processes raw queries in transit per its terms — zero-retention configuration is
            documented in docs/PRIVACY.md.
          </li>
          <li>Transport security relies on HTTPS/HSTS; the headers are enforced in proxy.ts.</li>
          <li>
            Queries exist briefly in server memory while being answered — that is inherent to
            answering them.
          </li>
          <li>
            Not HIPAA-compliant out of the box; the hardening path (BAAs, at-rest encryption, audit
            logging) is documented.
          </li>
        </ul>
      </section>

      <section className="run-band" aria-labelledby="privacy-verify">
        <p className="eyebrow">Verify it yourself</p>
        <h2 id="privacy-verify" className="visually-hidden">
          Verify it yourself
        </h2>
        <pre className="code-block">{`curl -X POST https://csbrainai.vercel.app/api/answer \\
  -H "Content-Type: application/json" \\
  -d '{"query":"What is RAG?"}'
# the response returns q_hash and q_len — exactly what was retained`}</pre>
        <p className="source-note">
          Source of truth: docs/PRIVACY.md (threat model, GDPR/CCPA/HIPAA notes, audit checklist,
          incident response) · implementation: lib/crypto-utils.ts, lib/sentry-utils.ts,
          lib/rate-limiter.ts
        </p>
      </section>
    </main>
  );
}
