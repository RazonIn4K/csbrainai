# CSBrainAI

**Privacy-First RAG System** powered by Supabase + pgvector, OpenAI, and Sentry

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-green.svg)](https://supabase.com/)
[![Sentry](https://img.shields.io/badge/Sentry-L5%20Tool-purple.svg)](https://sentry.io/)

---

## 🎯 Overview

CSBrainAI is an enterprise-grade Retrieval Augmented Generation (RAG) system with **privacy-first architecture**. User queries are **never stored in raw form** — only HMAC-SHA256 hashes and lengths are logged, ensuring complete privacy while maintaining full observability.

### Key Features

- 🔒 **Privacy-First**: HMAC-SHA256 hashed queries (no raw PII in logs)
- 🚀 **RAG Pipeline**: Supabase + pgvector for semantic search
- 🤖 **OpenAI Integration**: text-embedding-3-small + gpt-4o-mini
- 🛡️ **Security**: CSP, rate limiting (10 req/min), HSTS
- 📊 **Observability**: Sentry L5 tool with PII scrubbing
- 🧪 **Nightly Evals**: Automated quality testing via GitHub Actions
- ⚡ **Production-Ready**: Type-safe, tested, documented

---

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ query
       ▼
┌─────────────────────────┐
│  Next.js App Router     │
│  - Rate Limiting        │
│  - Security Headers     │
│  - PII Scrubbing        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  /api/answer            │
│  1. Hash query (HMAC)   │
│  2. Embed query (OpenAI)│
│  3. Vector search       │
│  4. LLM generation      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Supabase + pgvector    │
│  - IVFFlat index        │
│  - Cosine similarity    │
│  - RLS policies         │
└─────────────────────────┘
```

---

## 📦 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React framework |
| **Language** | TypeScript 5 | Type safety |
| **Database** | Supabase (PostgreSQL) | Vector storage with pgvector |
| **Embeddings** | OpenAI text-embedding-3-small | 1536-dim vectors |
| **LLM** | OpenAI gpt-4o-mini | Answer generation |
| **Observability** | Sentry | Error tracking (L5 tool) |
| **Rate Limiting** | Upstash Redis / Token Bucket | API protection |
| **Security** | Middleware | CSP, HSTS, headers |
| **CI/CD** | GitHub Actions | Nightly evaluations |

---

**This repo is part of my Upwork portfolio for GPT research agents with Notion integration, privacy-first RAG systems, and enterprise knowledge assistants.**

---

## 🚀 Quick Demo

**Prerequisites:**
- Node.js 20+
- Supabase account (for vector storage)
- OpenAI API key
- Sentry account (optional but recommended)

**Run the demo:**
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY

# 3. Run database migration (in Supabase SQL Editor)
# Copy contents of supabase/migrations/001_rag_schema.sql and execute

# 4. Ingest sample knowledge
npm run ingest

# 5. Start development server
make demo

# 6. Test the API (in another terminal)
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query":"What is RAG?"}'
```

**Expected Output:**
```json
{
  "answer": "RAG (Retrieval Augmented Generation) is an AI architecture...",
  "citations": [
    {
      "source_url": "file://sample-1.md#chunk-0",
      "content": "RAG (Retrieval Augmented Generation) is...",
      "similarity": 0.87
    }
  ],
  "q_hash": "a3f2b9c1d4e5f6a7b8c9d0e1f2a3b4c5...",
  "q_len": 12,
  "tokensUsed": 456
}
```

**Alternative demo (no setup needed):**
```bash
# Run unit tests to see functionality
make test-demo
```

---

## 💡 Where this fits for clients

This repository is a perfect starting point for clients who need:

- **A private internal knowledge base:** Answer questions from employees about internal documentation without sending sensitive data to third-party services.
- **A customer-facing chatbot:** Power a chatbot with your existing documentation, such as FAQs, product manuals, and support articles.
- **A lead generation tool:** Engage potential customers by answering their questions and guiding them through your sales funnel.

---

**Loom Demos:**

- [Coming Soon] Full Demo Video
- [Coming Soon] Technical Deep Dive

**Next Steps:**
- See `docs/ANSWER-FLOW.md` for API architecture
- See `docs/upwork/UPWORK_GPT_NOTION_AGENT.md` for Upwork summary
- See `TEST_NOTES.md` for manual test scenarios

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Supabase account
- OpenAI API key
- Sentry account (optional but recommended)

### 1. Clone & Install

```bash
git clone https://github.com/RazonIn4K/csbrainai.git
cd csbrainai
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE=eyJ...  # For ingestion only

# Security
HASH_SALT=$(openssl rand -hex 32)

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Optional: Upstash Redis (for distributed rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### 3. Database Setup

Run the migration in Supabase SQL Editor or via CLI:

```bash
# Copy contents of supabase/migrations/001_rag_schema.sql
# and execute in Supabase SQL Editor
```

Or using Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Ingest Knowledge

Add your knowledge files to `data/knowledge/`:

```bash
# Example structure:
data/knowledge/
├── faq.md
├── product-docs.md
└── technical-guide.md
```

Run ingestion:

```bash
npm run ingest
```

Expected output:
```
🚀 Starting RAG ingestion...
📚 Found 3 knowledge file(s)
...
✅ Ingestion complete!
📊 Summary:
  ├─ Total chunks: 42
  ├─ Processed: 42
  ├─ Skipped (duplicates): 0
  └─ Errors: 0
```

### 5. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 and try asking a question!

### 6. Run Evaluations

```bash
npm run evals
```

---

## 📖 Documentation

Comprehensive docs in the [`docs/`](./docs) directory:

- **[SCHEMA.md](./docs/SCHEMA.md)** - Database schema and indexes
- **[INGEST.md](./docs/INGEST.md)** - Ingestion process and chunking
- **[ANSWER-FLOW.md](./docs/ANSWER-FLOW.md)** - Answer API architecture
- **[PRIVACY.md](./docs/PRIVACY.md)** - Privacy guarantees and PII protection
- **[GO-LIVE-GATE.md](./docs/GO-LIVE-GATE.md)** - Production readiness checklist

---

## 🔐 Security & Privacy

### Privacy Guarantees

**✅ What we store:**
- Query hash (HMAC-SHA256)
- Query length
- Metadata (timestamps, token usage)

**❌ What we NEVER store:**
- Raw query text
- User identifiers (beyond IP for rate limiting)
- PII of any kind

### Security Measures

1. **Rate Limiting**: 10 requests/min/IP
2. **Security Headers**: CSP, HSTS, X-Frame-Options
3. **PII Scrubbing**: Automatic Sentry `beforeSend` hooks
4. **Input Validation**: Max query length, type checking
5. **HTTPS Only**: Enforced via HSTS

See [PRIVACY.md](./docs/PRIVACY.md) for full details.

---

## 🧪 Testing & Evaluation

### Nightly Evaluations

Automated quality testing runs nightly at 2 AM UTC:

```yaml
# .github/workflows/nightly-evals.yml
- Loads 20 test questions from data/evals/test-questions.jsonl
- Calls /api/answer for each question
- Validates response quality, citations, latency
- Uploads results as GitHub Actions artifact
- Fails only on severe regressions (< 50% quality)
```

Run manually:
```bash
npm run evals
```

### Manual Testing

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RAG?"}'
```

---

## 📊 API Reference

### `POST /api/answer`

Generate an answer using RAG.

**Request**:
```json
{
  "query": "What is RAG and how does it work?"
}
```

**Response** (200):
```json
{
  "answer": "RAG (Retrieval Augmented Generation) is an AI architecture...",
  "citations": [
    {
      "source_url": "file://sample-1.md#chunk-0",
      "content": "RAG (Retrieval Augmented Generation) is...",
      "similarity": 0.87
    }
  ],
  "q_hash": "a3f2b9c1d4e5f6a7b8c9d0e1f2a3b4c5...",
  "q_len": 35,
  "tokensUsed": 456
}
```

**Error** (429):
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

See [ANSWER-FLOW.md](./docs/ANSWER-FLOW.md) for complete API docs.

---

## 🛠️ Development

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run ingest       # Run ingestion script
npm run evals        # Run evaluation suite
```

### Project Structure

```
csbrainai/
├── app/
│   ├── api/answer/route.ts    # Answer endpoint
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/
│   └── AnswerDemo.tsx         # Demo UI
├── data/
│   ├── evals/                 # Evaluation questions
│   └── knowledge/             # Knowledge base files
├── docs/                      # Documentation
├── lib/
│   ├── crypto-utils.ts        # HMAC hashing
│   ├── openai.ts              # OpenAI client
│   ├── rate-limiter.ts        # Rate limiting
│   ├── sentry-utils.ts        # PII scrubbing
│   └── supabase.ts            # Database client
├── scripts/
│   ├── evals-runner.ts        # Evaluation script
│   └── ingest.ts              # Ingestion script
├── supabase/migrations/       # Database migrations
├── middleware.ts              # Security & rate limiting
├── sentry.client.config.ts    # Sentry client
└── sentry.server.config.ts    # Sentry server
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

Set all variables from `.env.example` in Vercel dashboard:
- Project Settings → Environment Variables

### Post-Deployment

1. Run database migration in Supabase
2. Run ingestion: `npm run ingest` (local or CI)
3. Verify Sentry integration
4. Test API endpoint
5. Check nightly evals workflow

See [GO-LIVE-GATE.md](./docs/GO-LIVE-GATE.md) for production checklist.

---

## 🔍 Monitoring

### Sentry Dashboard

Monitor in production:
- Error rate (target: < 1%)
- Performance (p95 < 3s)
- Rate limit violations
- PII scrubbing effectiveness

### Metrics to Track

- **Latency**: Median, p95, p99 response times
- **Quality**: Nightly eval scores
- **Cost**: OpenAI token usage
- **Errors**: 4xx/5xx rates

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) for pgvector support
- [OpenAI](https://openai.com/) for embeddings and LLM APIs
- [Sentry](https://sentry.io/) for observability
- [Next.js](https://nextjs.org/) for the framework
- [Upstash](https://upstash.com/) for serverless Redis

---

## 📞 Support

- **Documentation**: [docs/](./docs)
- **Issues**: [GitHub Issues](https://github.com/RazonIn4K/csbrainai/issues)
- **Security**: Email security@csbrainai.com for vulnerabilities

---

**Built with ❤️ for privacy-first AI applications**