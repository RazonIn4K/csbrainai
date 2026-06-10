import type { Metadata } from 'next';
import Link from 'next/link';
import { lanes } from './lanes';

export const metadata: Metadata = {
  title: 'Demo Lanes - CSBrainAI',
  description:
    'Three vertical demo lanes — policy & compliance, PDF finance, and the live CS knowledge demo — running on one privacy-first RAG engine.',
};

export default function ExamplesIndex() {
  return (
    <main className="site-shell">
      <header className="page-intro">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
        </nav>
        <p className="eyebrow">Demo lanes</p>
        <h1>Three lanes, one privacy-first engine.</h1>
        <p className="hero-lede">
          The same retrieval core — pgvector search, cited answers, hashed-query telemetry — pointed
          at three different corpora. Each lane documents its chunking, retrieval settings, question
          set, and exactly what gets logged.
        </p>
      </header>

      <section className="proof-grid" aria-label="Available demo lanes">
        {lanes.map((lane) => (
          <Link className="proof-item lane-card" href={`/examples/${lane.slug}`} key={lane.slug}>
            <p>{lane.cardLabel}</p>
            <h2>{lane.cardTitle}</h2>
            <span>{lane.cardBody}</span>
            <span className="lane-cta">View lane →</span>
          </Link>
        ))}
      </section>

      <section className="safeguards-band" aria-labelledby="shared-guarantees">
        <div>
          <p className="eyebrow">Shared guarantees</p>
          <h2 id="shared-guarantees">Every lane runs on the same trust model.</h2>
        </div>
        <ul>
          <li>Raw queries are never stored — telemetry keeps the HMAC-SHA256 hash and length only.</li>
          <li>Every answer carries citations with similarity scores back to a source chunk.</li>
          <li>A 20-question eval corpus scores answer quality nightly in CI.</li>
        </ul>
      </section>
    </main>
  );
}
