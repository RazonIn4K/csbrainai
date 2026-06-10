import Link from 'next/link';
import AnswerDemo from '@/components/AnswerDemo';
import { lanes } from './examples/lanes';

const proofPoints = [
  {
    label: 'Traceable Answers',
    title: 'Citations on every answer',
    body: 'Responses include matched source snippets with similarity scores, so a reviewer can inspect where each answer came from.',
  },
  {
    label: 'Private Telemetry',
    title: 'Raw queries never stored',
    body: 'Telemetry keeps a salted HMAC-SHA256 hash and a character count — operational signal with nothing to leak.',
  },
  {
    label: 'Measured Quality',
    title: 'Answers scored by an eval harness',
    body: 'A 20-question corpus runs against the live API with weighted scoring and a hard regression gate.',
  },
  {
    label: 'Inspectable Retrieval',
    title: 'pgvector search, documented',
    body: 'Supabase pgvector with an IVFFlat cosine index and a published schema — no black-box retrieval.',
  },
];

const systemRows = [
  ['Retrieval', 'Supabase and pgvector'],
  ['Generation', 'OpenAI answer synthesis'],
  ['Telemetry', 'Hashed queries only'],
  ['Quality', 'Nightly scored eval corpus'],
];

const trustPages = [
  {
    href: '/privacy-model',
    title: 'Privacy model',
    body: 'What gets logged, what never does, and the threat model behind the hashing.',
  },
  {
    href: '/evals',
    title: 'Evals',
    body: 'The 20-question corpus, the scoring weights, and the nightly regression gate.',
  },
  {
    href: '/architecture',
    title: 'Architecture',
    body: 'pgvector retrieval, the rag_docs schema, and the request lifecycle end to end.',
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Privacy-first RAG workbench</p>
          <h1 id="home-title">Private RAG workbench for technical teams.</h1>
          <p className="hero-lede">
            Cited answers without storing raw user questions. CSBrainAI turns internal documents —
            compliance policies, earnings transcripts, technical knowledge bases — into answers a
            reviewer can trace and an auditor can trust.
          </p>
          <div className="hero-actions" aria-label="Primary actions">
            <Link className="button-primary" href="/examples">
              Explore the demo lanes
            </Link>
            <a className="button-secondary" href="#ask">
              Try the live demo
            </a>
          </div>
        </div>

        <aside className="system-card" aria-label="System summary">
          <div className="system-card-header">
            <span className="status-dot" aria-hidden="true" />
            <span>System Stack</span>
          </div>
          <dl className="system-list">
            {systemRows.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="proof-grid proof-grid-4" aria-label="Product strengths">
        {proofPoints.map((point) => (
          <article className="proof-item" key={point.title}>
            <p>{point.label}</p>
            <h2>{point.title}</h2>
            <span>{point.body}</span>
          </article>
        ))}
      </section>

      <section className="band-heading" aria-labelledby="lanes-title">
        <p className="eyebrow">Demo lanes</p>
        <h2 id="lanes-title">Pick the corpus that looks like yours.</h2>
      </section>
      <section className="proof-grid" aria-label="Demo lanes">
        {lanes.map((lane) => (
          <Link className="proof-item lane-card" href={`/examples/${lane.slug}`} key={lane.slug}>
            <p>{lane.cardLabel}</p>
            <h2>{lane.cardTitle}</h2>
            <span>{lane.cardBody}</span>
            <span className="lane-cta">View lane →</span>
          </Link>
        ))}
      </section>

      <section className="demo-section" id="ask" aria-labelledby="demo-title">
        <div className="section-heading">
          <p className="eyebrow">Live answer flow</p>
          <h2 id="demo-title">Ask a technical question</h2>
          <p>
            This is the computer-science lane running end to end: answer text, citations, query
            metadata, and clear error states — through the same pipeline every lane uses.
          </p>
        </div>
        <AnswerDemo />
      </section>

      <section className="band-heading" aria-labelledby="trust-title">
        <p className="eyebrow">Trust console</p>
        <h2 id="trust-title">Inspect the claims before you believe them.</h2>
      </section>
      <section className="proof-grid" aria-label="Trust console">
        {trustPages.map((page) => (
          <Link className="proof-item lane-card" href={page.href} key={page.href}>
            <p>Trust console</p>
            <h2>{page.title}</h2>
            <span>{page.body}</span>
            <span className="lane-cta">View →</span>
          </Link>
        ))}
      </section>

      <section className="safeguards-band" id="safeguards" aria-labelledby="safeguards-title">
        <div>
          <p className="eyebrow">Privacy and reliability</p>
          <h2 id="safeguards-title">Built for real traffic without leaking raw prompts.</h2>
        </div>
        <ul>
          <li>HMAC-SHA256 query hashes for operational tracking.</li>
          <li>Structured validation before requests reach retrieval and generation.</li>
          <li>Sentry event filtering masks request data, breadcrumbs, and context fields.</li>
        </ul>
      </section>
    </main>
  );
}
