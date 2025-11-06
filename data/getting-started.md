# Getting Started with CSBrainAI

Welcome to CSBrainAI, a production-grade Retrieval Augmented Generation (RAG) system built with privacy and security at its core.

## What is CSBrainAI?

CSBrainAI is an AI-powered question-answering system that uses vector search to find relevant information from your knowledge base and generates accurate answers using large language models.

Key features:
- **Privacy-First**: Zero PII logging - we only store query hashes and lengths
- **Vector Search**: Powered by Supabase and pgvector for fast similarity search
- **OpenAI Integration**: Uses text-embedding-3-small for embeddings and gpt-4o-mini for generation
- **Security**: Rate limiting, CSP headers, and comprehensive PII scrubbing
- **Observability**: Sentry integration for error tracking and performance monitoring

## Quick Start

### 1. Set Up Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `HASH_SALT`: Random 32-byte hex string for query hashing
- `SENTRY_DSN`: Your Sentry DSN for error tracking

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database

Run the Supabase migration to create the pgvector schema:

```bash
npm run db:migrate
```

This will:
- Enable the pgvector extension
- Create the `rag_docs` table
- Set up IVFFlat index for fast vector search
- Create RPC function for similarity search

### 4. Ingest Your Data

Place your markdown or text files in the `/data` directory, then run the ingestion script:

```bash
npm run ingest
```

This will:
- Read all `.md` and `.txt` files from `/data`
- Chunk the content (1000 chars, 200 overlap)
- Generate embeddings via OpenAI
- Upload to Supabase

### 5. Start Development Server

```bash
npm run dev
```

Your API will be available at `http://localhost:3000/api/answer`

## Using the API

### POST /api/answer

Submit a question to get an AI-generated answer based on your knowledge base.

**Request:**
```json
{
  "query": "How do I get started with CSBrainAI?"
}
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
  "q_len": 35,
  "model": "gpt-4o-mini"
}
```

### Rate Limits

- **10 requests per minute** per IP address
- Uses Upstash Redis if configured, otherwise in-memory token bucket
- Returns 429 status with `Retry-After` header when exceeded

## Next Steps

- Read the [API Reference](data/api-reference.md) for detailed endpoint documentation
- Check out [FAQ](data/faq.txt) for common questions
- Review the [PRIVACY.md](policies/PRIVACY.md) for our privacy policy
- See [SECURITY.md](policies/SECURITY.md) for security details

## Need Help?

Check the FAQ or review the architecture documentation in `ARCHITECTURE.md` for detailed system design information.
