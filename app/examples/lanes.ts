export interface LaneTranscript {
  /** Exact command the output was captured from. */
  command: string;
  /** ISO date the run was captured. */
  capturedAt: string;
  question: string;
  answer: string;
  citations: { source: string; similarity: number }[];
}

export interface Lane {
  slug: string;
  cardLabel: string;
  cardTitle: string;
  cardBody: string;
  eyebrow: string;
  title: string;
  lede: string;
  useCase: string;
  sourceType: string;
  /** Label/value rows for the chunking & retrieval card. */
  retrieval: [string, string][];
  questions: string[];
  questionsNote?: string;
  privacy: string[];
  runLocally: string[];
  sourceFiles: string[];
  cta?: { label: string; href: string };
  /**
   * A real captured run, pasted verbatim from the command in `command`.
   * Never fill this with synthetic output — the page renders a pending
   * state until a genuine transcript exists.
   */
  transcript: LaneTranscript | null;
}

export const lanes: Lane[] = [
  {
    slug: 'policy',
    cardLabel: 'Policy & Compliance',
    cardTitle: 'Audit-ready answers over policy PDFs',
    cardBody:
      'Point the config at a folder of compliance PDFs and answer "where does it say that?" with citations down to the chunk.',
    eyebrow: 'Demo lane · Policy & compliance',
    title: 'Audit-ready answers over security policies.',
    lede:
      'A config-driven assistant for regulated content: drop policy PDFs in a folder, ingest, and ask access-control, retention, and escalation questions. Every answer carries citations an auditor can trace back to the source document.',
    useCase:
      'Security and compliance teams with hundreds of policy PDFs who field "where does it say that?" questions and need answers that map to a specific document and chunk, not a vague summary.',
    sourceType:
      'PDF policies in examples/policy_compliance_assistant/policies/ — or any folder set in config.ts. Swapping to a new policy set is a config change, not a code change.',
    retrieval: [
      ['Chunking', '1,200 chars, 150 overlap, 180 minimum (config.ts)'],
      ['Retrieval', 'Top 6 matches at ≥ 0.55 cosine similarity'],
      ['Source scheme', 'policy://<file>#chunk-<n>'],
      ['Embeddings', 'text-embedding-3-small (1536-dim) in Supabase pgvector'],
      ['Dedupe', 'HMAC chunk hash, idempotent upsert'],
    ],
    questions: [
      'Summarize the key data retention requirements we must enforce.',
      'What access controls must auditors review quarterly?',
      'List the escalation steps if a privacy breach is detected.',
    ],
    questionsNote:
      'Defined in config.ts — they run when policy:ask is called with no arguments. Any one-off question can be passed on the command line.',
    privacy: [
      'Questions are processed in memory; telemetry records the HMAC-SHA256 hash and length of a query, never its raw text.',
      'Citations use the policy:// scheme, so answers trace to a document and chunk — not to a user or session.',
      'Prompt-guard hooks flag attempts to extract system prompts; Sentry events pass through recursive PII scrubbing.',
    ],
    runLocally: [
      '# drop PDFs into examples/policy_compliance_assistant/policies/',
      'npm run policy:ingest',
      'npm run policy:ask',
      'npm run policy:ask -- "Which roles can approve production access?"',
    ],
    sourceFiles: [
      'examples/policy_compliance_assistant/config.ts',
      'examples/policy_compliance_assistant/ingest.ts',
      'examples/policy_compliance_assistant/ask.ts',
    ],
    transcript: null,
  },
  {
    slug: 'finance',
    cardLabel: 'PDF Finance Assistant',
    cardTitle: 'Earnings-call answers with citations',
    cardBody:
      'Ingest quarterly earnings PDFs and surface guidance shifts, risk factors, and capital commitments with similarity-scored citations.',
    eyebrow: 'Demo lane · Finance',
    title: 'Earnings-call answers with citations.',
    lede:
      'A turnkey PDF-to-Q&A workflow for finance teams: ingest quarterly transcripts, then ask about revenue guidance, risk factors, and capital allocation. Answers come back with per-chunk citations and similarity scores.',
    useCase:
      'FP&A and investor-relations teams mining earnings transcripts for guidance deltas without an analyst reading every page — with question-level traceability for reviewers.',
    sourceType:
      'Quarterly earnings and transcript PDFs in examples/pdf_finance_assistant/pdfs/ (any folder path can be passed to the ingest command).',
    retrieval: [
      ['Chunking', '~1,600 chars, 200 overlap, chunks under 200 chars dropped (ingest.ts)'],
      ['Retrieval', 'Top 5 matches at ≥ 0.5 cosine similarity'],
      ['Source scheme', 'file://<pdf>#chunk-<n>'],
      ['Embeddings', 'text-embedding-3-small (1536-dim) in Supabase pgvector'],
      ['Dedupe', 'HMAC chunk hash, idempotent upsert'],
    ],
    questions: [
      'Summarize revenue guidance vs. last quarter.',
      'Highlight the top 3 risk factors the CFO flagged.',
      'What capital allocation commitments were made?',
    ],
    questionsNote:
      'Defined in ask.ts — they run when finance:ask is called with no arguments. Any one-off question can be passed on the command line.',
    privacy: [
      'Questions are processed in memory; telemetry records the HMAC-SHA256 hash and length of a query, never its raw text.',
      'Citations use file:// URLs pointing at the source PDF and chunk index.',
      'Per-run metrics (latency, token usage, cost) are logged without query text via the RagMetrics tracker.',
    ],
    runLocally: [
      '# drop PDFs into examples/pdf_finance_assistant/pdfs/',
      'npm run finance:ingest',
      'npm run finance:ask',
      'npm run finance:ask -- "Where are we seeing margin compression?"',
    ],
    sourceFiles: [
      'examples/pdf_finance_assistant/ingest.ts',
      'examples/pdf_finance_assistant/ask.ts',
    ],
    transcript: null,
  },
  {
    slug: 'cs',
    cardLabel: 'CS Knowledge Demo',
    cardTitle: 'The live web demo, end to end',
    cardBody:
      'The interactive lane: a curated computer-science corpus behind POST /api/answer with rate limiting, prompt guarding, and hashed telemetry.',
    eyebrow: 'Demo lane · Computer science',
    title: 'The live web lane: CS answers with guarded logging.',
    lede:
      'This is the lane the homepage demo runs on — a curated computer-science and security corpus served through the full web pipeline: validation, prompt guard, rate limiting, retrieval, and citation construction.',
    useCase:
      'Anyone evaluating the end-to-end web flow rather than the CLI: the same retrieval engine, but exposed through a public, rate-limited API with the privacy guarantees enforced at the HTTP boundary.',
    sourceType:
      'Curated markdown/text files in data/knowledge/, chunked to ≤ 2,000 chars by scripts/ingest.ts.',
    retrieval: [
      ['Chunking', '≤ 2,000 chars per chunk (scripts/ingest.ts)'],
      ['Retrieval', 'Top 5 matches at ≥ 0.5 cosine similarity (app/api/answer/route.ts)'],
      ['Source scheme', 'file://<path>#chunk-<n>'],
      ['Rate limit', '10 requests/min per IP, token bucket'],
      ['Contract', 'GET /api/answer returns the full API docs'],
    ],
    questions: [
      'What is RAG and how does it work?',
      'Explain the difference between symmetric and asymmetric encryption',
      'What are common SQL injection prevention techniques?',
    ],
    questionsNote:
      'These are the homepage demo presets. A 20-question eval corpus (data/evals/test-questions.jsonl) runs nightly in CI, scored 40% keyword match / 30% citations / 20% non-empty / 10% latency, with a ≥ 50% pass gate.',
    privacy: [
      'The route hashes the query before anything else; responses return q_hash and q_len so callers can verify what is retained.',
      'A prompt-injection guard screens inputs before retrieval and generation.',
      'Rate limiting and Sentry PII scrubbing are enforced at the API boundary, not left to the client.',
    ],
    runLocally: [
      'npm run ingest        # data/knowledge/ -> Supabase',
      'npm run dev',
      'curl -X POST http://localhost:3000/api/answer \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"query":"What is RAG?"}\'',
      'npm run evals         # score the 20-question corpus',
    ],
    sourceFiles: [
      'app/api/answer/route.ts',
      'scripts/ingest.ts',
      'data/evals/test-questions.jsonl',
    ],
    cta: { label: 'Open the live demo', href: '/#ask' },
    transcript: null,
  },
];

export function getLane(slug: string): Lane {
  const lane = lanes.find((entry) => entry.slug === slug);
  if (!lane) {
    throw new Error(`Unknown example lane: ${slug}`);
  }
  return lane;
}
