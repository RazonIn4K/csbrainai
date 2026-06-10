import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Architecture - CSBrainAI',
  description:
    'Supabase pgvector retrieval (rag_docs, IVFFlat, cosine), OpenAI embeddings and generation, and the request lifecycle from validation to cited answer.',
};

const store = [
  ['Table', 'rag_docs — source_url, content, embedding, chunk_hash, model + dates'],
  ['Vectors', 'vector(1536) from text-embedding-3-small'],
  ['Index', 'IVFFlat, cosine ops, 100 lists (tuned for ~10k chunks)'],
  ['Search', 'match_documents RPC — similarity = 1 − cosine distance'],
  ['Dedupe', 'Unique HMAC-SHA256 chunk_hash; re-ingestion is idempotent'],
  ['Access', 'RLS: service role writes (ingestion), anon key reads (API)'],
] as const;

const lifecycle = [
  'Zod validates the request body; the rate limiter (10 req/min/IP) and security headers are enforced in proxy.ts before the route runs.',
  'The prompt-injection guard screens the query (log or block mode).',
  'The query is hashed (salted HMAC-SHA256) — from here on, telemetry only ever sees q_hash and q_len.',
  'OpenAI embeds the query; the embedding is ephemeral and never stored.',
  'match_documents returns the top 5 chunks at ≥ 0.5 cosine similarity.',
  'gpt-4o-mini generates the answer from the retrieved context only.',
  'Citations are built from the matched chunks: source_url, snippet, similarity score.',
  'RagMetrics logs one structured record — latency, vector-search ms, chunk count, tokens, estimated cost — plus a scrubbed Sentry breadcrumb.',
] as const;

export default function ArchitecturePage() {
  return (
    <main className="site-shell">
      <header className="page-intro">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <span>Trust console</span>
        </nav>
        <p className="eyebrow">Trust console · Architecture</p>
        <h1>One retrieval engine, inspectable end to end.</h1>
        <p className="hero-lede">
          Ingestion chunks and embeds documents into Supabase pgvector; the API embeds your
          question, matches against the same index, and generates an answer it can cite. This page
          summarizes docs/architecture.md and docs/SCHEMA.md — the docs are the source of truth.
        </p>
      </header>

      <section className="lane-facts" aria-label="Ingestion and retrieval store">
        <div className="fact-card">
          <h2>Ingestion side</h2>
          <p>
            scripts/ingest.ts and the examples/* lane runners share one pipeline: read markdown or
            PDF, normalize and chunk (per-lane sizes and overlaps), embed each chunk with
            text-embedding-3-small, and upsert keyed on the chunk&apos;s HMAC hash. Writes use the
            Supabase service role; re-running an ingest never duplicates chunks.
          </p>
          <h2>Serving side</h2>
          <p>
            POST /api/answer runs on the Node.js runtime with dynamic rendering. It reads with the
            anon key under row-level security — the serving path physically cannot write to the
            knowledge store.
          </p>
        </div>
        <aside className="system-card" aria-label="Vector store details">
          <div className="system-card-header">
            <span className="status-dot" aria-hidden="true" />
            <span>Vector store</span>
          </div>
          <dl className="system-list">
            {store.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="safeguards-band" aria-labelledby="arch-lifecycle">
        <div>
          <p className="eyebrow">Request lifecycle</p>
          <h2 id="arch-lifecycle">What happens to a question, in order</h2>
          <p className="band-note">
            The order matters: hashing happens before any external call, so no downstream failure
            can leak a raw query into logs.
          </p>
        </div>
        <ol className="flow-list">
          {lifecycle.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="run-band" aria-labelledby="arch-source">
        <p className="eyebrow">Inspect the schema</p>
        <h2 id="arch-source" className="visually-hidden">
          Inspect the schema
        </h2>
        <pre className="code-block">{`-- supabase/migrations/001_rag_schema.sql
CREATE INDEX idx_rag_docs_embedding
ON rag_docs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

SELECT * FROM match_documents('[…]'::vector(1536), 0.5, 5);`}</pre>
        <p className="source-note">
          Source of truth: docs/architecture.md, docs/SCHEMA.md,
          supabase/migrations/001_rag_schema.sql · implementation: app/api/answer/route.ts,
          lib/supabase.ts, lib/openai.ts
        </p>
      </section>
    </main>
  );
}
