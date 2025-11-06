# CSBrainAI

**Production-Grade RAG System with Privacy-First Architecture**

[![CI](https://github.com/RazonIn4K/csbrainai/actions/workflows/ci.yml/badge.svg)](https://github.com/RazonIn4K/csbrainai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CSBrainAI is a production-ready Retrieval Augmented Generation (RAG) system built with:
- 🔒 **Privacy First:** Zero PII logging - only stores `{hash, length}`
- 🚀 **Vector Search:** Supabase + pgvector with IVFFlat indexing
- 🤖 **OpenAI Integration:** text-embedding-3-small + gpt-4o-mini
- 🛡️ **Security:** CSP headers, rate limiting, PII scrubbing
- 📊 **Observability:** Sentry L5 integration for error tracking
- ✅ **CI/CD:** Nightly evals, type-checking, SBOM generation

---

## 📋 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Supabase account ([sign up](https://supabase.com))
- Sentry account ([sign up](https://sentry.io)) - optional but recommended

### 1. Clone & Install

```bash
git clone https://github.com/RazonIn4K/csbrainai.git
cd csbrainai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE=eyJ...  # For ingest script

# Security
HASH_SALT=your-random-32-byte-hex-string

# Sentry (optional)
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### 3. Set Up Database

Run the pgvector migration:

```bash
# Option 1: Using psql
psql $SUPABASE_URL < supabase/migrations/001_init_rag.sql

# Option 2: Using Supabase dashboard
# Copy contents of 001_init_rag.sql into SQL Editor and run
```

### 4. Ingest Documents

Place your `.md` or `.txt` files in the `/data` directory, then run:

```bash
npm run ingest
```

This will:
- Chunk documents (1000 chars, 200 overlap)
- Generate embeddings via OpenAI
- Upload to Supabase with pgvector

### 5. Start Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app!

---

## 🚀 Usage

### API Endpoint

**POST /api/answer**

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I get started with CSBrainAI?"}'
```

**Response:**

```json
{
  "answer": "To get started with CSBrainAI, first set up your environment variables...",
  "citations": [
    {
      "source_url": "data/getting-started.md",
      "snippet": "Welcome to CSBrainAI, a production-grade RAG system..."
    }
  ],
  "q_hash": "a3f5e8b2...",
  "q_len": 42,
  "model": "gpt-4o-mini"
}
```

### Rate Limits

- **10 requests per minute** per IP address
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded

---

## 📁 Project Structure

```
csbrainai/
├── app/                      # Next.js 13+ App Router
│   ├── api/answer/           # RAG endpoint
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Homepage
├── lib/                      # Core libraries
│   ├── sentry/               # Sentry integration (PII scrubbing)
│   ├── security/             # Rate limiting & headers
│   ├── supabase/             # Database & vector search
│   ├── openai/               # Embeddings & chat
│   └── utils/                # Hashing & chunking
├── scripts/                  # Automation scripts
│   ├── ingest.ts             # Document ingestion pipeline
│   └── evals-runner.js       # Nightly evaluation harness
├── supabase/migrations/      # Database schema
├── evals/                    # Evaluation test data
├── data/                     # Source documents
├── policies/                 # Governance documents
├── .github/workflows/        # CI/CD pipelines
└── middleware.ts             # Security middleware
```

---

## 🔒 Privacy & Security

### Zero PII Logging

CSBrainAI **never** logs raw query text. We only store:

```typescript
{
  q_hash: "HMAC-SHA256(query, secret_salt)",  // Irreversible hash
  q_len: 42                                    // Character count
}
```

This allows usage analytics while protecting user privacy.

### Security Features

- ✅ CSP headers (prevent XSS, clickjacking)
- ✅ Rate limiting (Upstash Redis or token bucket)
- ✅ PII scrubbing (Sentry beforeSend hooks)
- ✅ HTTPS enforced (HSTS header)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Prompt injection mitigation (context-only prompts)

See [SECURITY.md](policies/SECURITY.md) for full details.

---

## 📊 Observability (L5: Sentry)

### Error Tracking

All errors are captured in Sentry with:
- Stack traces
- Request metadata (URL, method, status)
- Query metadata (`q_hash`, `q_len`) - **NOT raw queries**

### Performance Monitoring

Track:
- API latency (p50, p95, p99)
- OpenAI embedding generation time
- Vector search duration
- LLM completion time

See [Tool-Analytics.md](policies/Tool-Analytics.md) for details.

---

## 🧪 Testing

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Nightly Evaluations

```bash
npm run evals
```

Runs 20 test questions from `evals/questions.jsonl` and generates a report.

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy!

### Other Platforms

- **AWS Lambda / ECS:** Use Docker
- **Google Cloud Run:** Container-based deployment
- **DigitalOcean App Platform:** Node.js buildpack

See [ARCHITECTURE.md](ARCHITECTURE.md) for deployment details.

---

## 📚 Documentation

- [Architecture](ARCHITECTURE.md) - System design & data flow
- [Getting Started](data/getting-started.md) - User guide
- [API Reference](data/api-reference.md) - Endpoint documentation
- [FAQ](data/faq.txt) - Common questions
- [Go-Live Gate](policies/Go-Live-Gate.md) - Launch checklist
- [Tool Analytics](policies/Tool-Analytics.md) - Sentry integration
- [Security](policies/SECURITY.md) - Security architecture
- [Privacy](policies/PRIVACY.md) - Privacy policy

---

## 🛠️ Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript checks |
| `npm run ingest` | Ingest documents |
| `npm run evals` | Run evaluation tests |

### Environment Variables

See [.env.example](.env.example) for all available options.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org) - React framework
- [Supabase](https://supabase.com) - Postgres + pgvector
- [OpenAI](https://openai.com) - Embeddings + LLM
- [Sentry](https://sentry.io) - Error tracking
- [Upstash](https://upstash.com) - Redis for rate limiting

---

## 📧 Contact

- **Email:** engineering@csbrainai.com
- **Security:** security@csbrainai.com
- **Privacy:** privacy@csbrainai.com

---

## 🗺️ Roadmap

- [ ] Hybrid search (BM25 + vector)
- [ ] Streaming responses (SSE)
- [ ] Multi-tenant support
- [ ] PDF/DOCX ingestion
- [ ] A/B testing framework
- [ ] User feedback loop (thumbs up/down)

See [GitHub Issues](https://github.com/RazonIn4K/csbrainai/issues) for details.

---

**Built with ❤️ by the CSBrainAI team**