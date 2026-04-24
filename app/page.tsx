import AnswerDemo from '@/components/AnswerDemo';

const proofPoints = [
  {
    label: 'Traceable Answers',
    title: 'Citations stay visible',
    body: 'Responses include matched source snippets so a reviewer can inspect where the answer came from.',
  },
  {
    label: 'Private Telemetry',
    title: 'Queries are hashed',
    body: 'The app records operational signals without storing the raw question text in logs.',
  },
  {
    label: 'Controlled Access',
    title: 'Rate limits are enforced',
    body: 'API traffic is guarded with rate-limit responses and clear retry timing for the interface.',
  },
];

const systemRows = [
  ['Retrieval', 'Supabase and pgvector'],
  ['Generation', 'OpenAI answer synthesis'],
  ['Monitoring', 'Sentry with PII scrubbing'],
  ['Validation', 'Zod request boundaries'],
];

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Private RAG assistant</p>
          <h1 id="home-title">Computer science answers with citations and guarded logging.</h1>
          <p className="hero-lede">
            CSBrainAI turns a curated technical knowledge base into reviewed answers for computer
            science, cybersecurity, and software engineering questions.
          </p>
          <div className="hero-actions" aria-label="Primary actions">
            <a className="button-primary" href="#ask">
              Try the demo
            </a>
            <a className="button-secondary" href="#safeguards">
              View safeguards
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

      <section className="proof-grid" aria-label="Product strengths">
        {proofPoints.map((point) => (
          <article className="proof-item" key={point.title}>
            <p>{point.label}</p>
            <h2>{point.title}</h2>
            <span>{point.body}</span>
          </article>
        ))}
      </section>

      <section className="demo-section" id="ask" aria-labelledby="demo-title">
        <div className="section-heading">
          <p className="eyebrow">Live answer flow</p>
          <h2 id="demo-title">Ask a technical question</h2>
          <p>
            Use the examples or write your own prompt. The interface shows answer text, citations,
            query metadata, and clear error states.
          </p>
        </div>
        <AnswerDemo />
      </section>

      <section className="safeguards-band" id="safeguards" aria-labelledby="safeguards-title">
        <div>
          <p className="eyebrow">Privacy and reliability</p>
          <h2 id="safeguards-title">Built for demo traffic without leaking raw prompts.</h2>
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
