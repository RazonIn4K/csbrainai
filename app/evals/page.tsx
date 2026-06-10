import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Evals - CSBrainAI',
  description:
    'How answer quality is scored: a 20-question corpus, weighted scoring (keywords, citations, completeness, latency), a 50% regression gate, and nightly CI.',
};

const scoring = [
  ['40% — Keywords', 'Share of expected keywords present in the answer'],
  ['30% — Citations', 'At least one source chunk cited'],
  ['20% — Substance', 'Non-trivial answer text returned'],
  ['10% — Latency', 'Response under 5 seconds'],
  ['Gate', 'Overall quality below 50% fails the run'],
] as const;

export default function EvalsPage() {
  return (
    <main className="site-shell">
      <header className="page-intro">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <span>Trust console</span>
        </nav>
        <p className="eyebrow">Trust console · Evals</p>
        <h1>Answer quality is a number, checked nightly.</h1>
        <p className="hero-lede">
          A 20-question corpus runs against the real /api/answer endpoint — not the libraries
          underneath it — and every answer is scored on keywords, citations, substance, and
          latency. Below 50% overall, the run fails loudly.
        </p>
      </header>

      <section className="lane-facts" aria-label="Corpus and scoring">
        <div className="fact-card">
          <h2>The corpus</h2>
          <p>
            data/evals/test-questions.jsonl — 20 questions across concept, technical, architecture,
            security, and operations categories, each with expected keywords. The questions probe
            the system about itself: retrieval mechanics, the privacy model, rate limits, schema
            choices.
          </p>
          <h2>The harness</h2>
          <p>
            scripts/evals-runner.ts posts each question to /api/answer over HTTP, so a passing run
            exercises validation, the prompt guard, retrieval, generation, and citation
            construction end to end. Results are written to eval-results.json and a human-readable
            eval-summary.txt.
          </p>
        </div>
        <aside className="system-card" aria-label="Scoring weights">
          <div className="system-card-header">
            <span className="status-dot" aria-hidden="true" />
            <span>Scoring model</span>
          </div>
          <dl className="system-list">
            {scoring.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="demo-section" aria-labelledby="evals-latest">
        <div className="section-heading">
          <p className="eyebrow">Latest scores</p>
          <h2 id="evals-latest">Recent eval results</h2>
        </div>
        <div className="transcript">
          <p className="transcript-pending">
            No scores are published right now, and that is the honest state: the nightly pipeline
            has no successful run in its retained history, and production recovery is an open
            incident tracked in docs/OPERATIONS.md. This panel only ever shows real
            eval-summary.txt numbers — once the pipeline is healthy again, the latest overall
            quality, per-category scores, and run date get published here.
          </p>
        </div>
      </section>

      <section className="safeguards-band" aria-labelledby="evals-ci">
        <div>
          <p className="eyebrow">Continuous verification</p>
          <h2 id="evals-ci">How the nightly run works</h2>
        </div>
        <ul>
          <li>GitHub Actions cron at 2:00 UTC (plus manual dispatch) builds and boots the app.</li>
          <li>The runner scores all 20 questions against the live server.</li>
          <li>Results upload as artifacts with 30-day retention.</li>
          <li>
            Below the 50% gate, the workflow fails and comments the summary on the latest commit —
            regressions are loud, not silent.
          </li>
        </ul>
      </section>

      <section className="run-band" aria-labelledby="evals-run">
        <p className="eyebrow">Run it locally</p>
        <h2 id="evals-run" className="visually-hidden">
          Run it locally
        </h2>
        <pre className="code-block">{`npm run dev          # or point API_URL at any deployment
npm run evals        # scores all 20 questions, writes eval-results.json`}</pre>
        <p className="source-note">
          Source of truth: scripts/evals-runner.ts, data/evals/test-questions.jsonl,
          .github/workflows/nightly-evals.yml
        </p>
      </section>
    </main>
  );
}
