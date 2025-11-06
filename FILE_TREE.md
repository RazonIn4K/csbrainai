# CSBrainAI - Complete File Tree

```
csbrainai/
├── .github/
│   └── workflows/
│       ├── nightly-evals.yml       # Scheduled evaluation tests
│       └── ci.yml                   # Type-check, lint, SBOM
│
├── .vscode/
│   └── settings.json                # Recommended IDE config
│
├── app/                             # Next.js 13+ App Router
│   ├── api/
│   │   └── answer/
│   │       └── route.ts             # POST /api/answer - main RAG endpoint
│   ├── layout.tsx                   # Root layout with Sentry provider
│   └── page.tsx                     # Homepage (optional demo UI)
│
├── data/                            # Source documents for ingestion
│   ├── getting-started.md
│   ├── api-reference.md
│   └── faq.txt
│
├── evals/                           # Evaluation test data
│   └── questions.jsonl              # 20 test questions for nightly runs
│
├── lib/
│   ├── sentry/
│   │   ├── client.ts                # Client-side Sentry init (PII scrubber)
│   │   └── server.ts                # Server-side Sentry init
│   ├── security/
│   │   ├── rate-limit.ts            # Upstash Redis or token bucket
│   │   └── headers.ts               # CSP and security headers
│   ├── supabase/
│   │   ├── client.ts                # Supabase client factory
│   │   └── vector-search.ts         # Vector similarity search helper
│   ├── openai/
│   │   ├── embeddings.ts            # Embedding generation
│   │   └── chat.ts                  # Chat completion wrapper
│   └── utils/
│       ├── hash.ts                  # HMAC-SHA256 hashing for queries
│       └── chunk.ts                 # Text chunking utility
│
├── scripts/
│   ├── ingest.ts                    # Ingest pipeline: chunk → embed → upsert
│   └── evals-runner.js              # Nightly eval test harness
│
├── supabase/
│   └── migrations/
│       └── 001_init_rag.sql         # pgvector extension + rag_docs table
│
├── policies/
│   ├── Go-Live-Gate.md              # Launch readiness checklist
│   ├── Tool-Analytics.md            # Observability strategy (L5=Sentry)
│   ├── SECURITY.md                  # Security architecture & threat model
│   └── PRIVACY.md                   # Privacy policy & PII handling
│
├── .env.example                     # Template for environment variables
├── .env.local                       # Local secrets (gitignored)
├── .gitignore
├── ARCHITECTURE.md                  # This design document
├── FILE_TREE.md                     # This file
├── README.md                        # Project overview & quick start
├── instrumentation.ts               # Next.js 13+ instrumentation (Sentry)
├── middleware.ts                    # Security headers + rate limiting
├── next.config.js                   # Next.js configuration
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
└── eslint.config.js                 # ESLint rules

```

## Key File Responsibilities

### Runtime (Production)
| File | Purpose |
|------|---------|
| `app/api/answer/route.ts` | Core RAG endpoint: embed → search → generate |
| `middleware.ts` | Security headers, rate limiting, CORS |
| `lib/sentry/server.ts` | Error tracking with PII scrubbing |
| `lib/security/rate-limit.ts` | 10 req/min per IP (Upstash or fallback) |
| `lib/supabase/vector-search.ts` | pgvector similarity search (top-k) |
| `lib/openai/embeddings.ts` | text-embedding-3-small (1536-dim) |
| `lib/openai/chat.ts` | gpt-4o-mini with context prompt |
| `lib/utils/hash.ts` | HMAC-SHA256 for query anonymization |

### Build Time (CI/CD)
| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Type-check, lint, SBOM generation |
| `.github/workflows/nightly-evals.yml` | Scheduled eval runs (2 AM daily) |
| `scripts/evals-runner.js` | POST 20 questions to /api/answer |
| `evals/questions.jsonl` | Regression test suite |

### Data Pipeline (Offline)
| File | Purpose |
|------|---------|
| `scripts/ingest.ts` | Read /data → chunk → embed → Supabase |
| `supabase/migrations/001_init_rag.sql` | Schema: vector extension + ivfflat index |
| `data/*.{md,txt}` | Source documents (knowledge base) |

### Documentation & Governance
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System design & data flow |
| `policies/Go-Live-Gate.md` | Launch checklist (security, legal, perf) |
| `policies/Tool-Analytics.md` | Sentry integration & telemetry |
| `policies/SECURITY.md` | Threat model & mitigation strategies |
| `policies/PRIVACY.md` | PII handling & data retention |

---

**Total Files:** ~35
**Total LOC:** ~3,500 (estimated)
**Languages:** TypeScript (95%), SQL (3%), YAML (2%)
