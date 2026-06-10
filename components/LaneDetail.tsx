import Link from 'next/link';
import type { Lane } from '@/app/examples/lanes';

export default function LaneDetail({ lane }: { lane: Lane }) {
  return (
    <main className="site-shell">
      <header className="page-intro">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/examples">Demo lanes</Link>
        </nav>
        <p className="eyebrow">{lane.eyebrow}</p>
        <h1>{lane.title}</h1>
        <p className="hero-lede">{lane.lede}</p>
        {lane.cta ? (
          <div className="hero-actions" aria-label="Lane actions">
            <Link className="button-primary" href={lane.cta.href}>
              {lane.cta.label}
            </Link>
          </div>
        ) : null}
      </header>

      <section className="lane-facts" aria-label="Use case and configuration">
        <div className="fact-card">
          <h2>Use case</h2>
          <p>{lane.useCase}</p>
          <h2>Knowledge source</h2>
          <p>{lane.sourceType}</p>
        </div>
        <aside className="system-card" aria-label="Chunking and retrieval">
          <div className="system-card-header">
            <span className="status-dot" aria-hidden="true" />
            <span>Chunking &amp; retrieval</span>
          </div>
          <dl className="system-list">
            {lane.retrieval.map(([label, value]) => (
              <div className="system-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="safeguards-band" aria-labelledby={`${lane.slug}-questions`}>
        <div>
          <p className="eyebrow">Curated question set</p>
          <h2 id={`${lane.slug}-questions`}>Questions this lane ships with</h2>
          {lane.questionsNote ? <p className="band-note">{lane.questionsNote}</p> : null}
        </div>
        <ul>
          {lane.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>

      <section className="demo-section" aria-labelledby={`${lane.slug}-transcript`}>
        <div className="section-heading">
          <p className="eyebrow">Sample run</p>
          <h2 id={`${lane.slug}-transcript`}>Captured transcript</h2>
        </div>
        {lane.transcript ? (
          <div className="transcript">
            <pre className="code-block">$ {lane.transcript.command}</pre>
            <p className="transcript-question">
              <strong>Q:</strong> {lane.transcript.question}
            </p>
            <p className="transcript-answer">{lane.transcript.answer}</p>
            <div className="citation-list">
              {lane.transcript.citations.map((citation, index) => (
                <div className="citation-item" key={`${citation.source}-${index}`}>
                  <div className="citation-meta">
                    <span className="citation-source">{citation.source}</span>
                    <span>score {citation.similarity.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="transcript-stamp">
              Captured {lane.transcript.capturedAt} from a real run — output is verbatim.
            </p>
          </div>
        ) : (
          <div className="transcript">
            <p className="transcript-pending">
              No captured run is published for this lane yet. This slot only ever shows verbatim
              output from a real run — nothing on this page is synthetic. Use the commands in
              the &ldquo;Run it locally&rdquo; section below with credentials and a corpus in
              place.
            </p>
          </div>
        )}
      </section>

      <section className="safeguards-band" aria-labelledby={`${lane.slug}-privacy`}>
        <div>
          <p className="eyebrow">Privacy &amp; logging</p>
          <h2 id={`${lane.slug}-privacy`}>What gets recorded</h2>
        </div>
        <ul>
          {lane.privacy.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="run-band" aria-labelledby={`${lane.slug}-run`}>
        <p className="eyebrow">Run it locally</p>
        <h2 id={`${lane.slug}-run`} className="visually-hidden">
          Run it locally
        </h2>
        <pre className="code-block">{lane.runLocally.join('\n')}</pre>
        <p className="source-note">Source: {lane.sourceFiles.join(' · ')}</p>
      </section>
    </main>
  );
}
