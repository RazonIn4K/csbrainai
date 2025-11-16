# Loom Script & Service Description – csbrainai

## Loom Script – Regulated-Domain RAG + Metrics

**Goal:** Show ingestion → querying → metrics + security guards in ~3–4 minutes.

**Outline:**

1. **Intro & Ingest (0:00–1:00)**
   "Hi, I'll show how our regulated-domain RAG stack works end-to-end."
   - Run: `npm run finance:ingest`.
   - Explain: reads finance PDFs, chunks with overlap, hashes chunks to dedupe, embeds into Supabase.

2. **Ask Flow (1:00–1:45)**
   - Run: `npm run finance:ask`.
   - Show curated questions like "Summarize revenue guidance."
   - Point out: fast responses with citations and source doc IDs.

3. **Metrics (1:45–2:30)**
   - Open `/api/admin/metrics` or run `npm run metrics:summary`.
   - Explain metrics: latency, vector search time, chunk counts, success/error rate, estimated cost per query (via `ai-utils`).

4. **Performance & Cost (2:30–3:00)**
   - "We keep latency under ~1.2s using small embeddings, tight chunk sizes, and top-k retrieval. Cost per query is under a penny, which matters in CFO conversations."

5. **Prompt Guard & Security (3:00–3:30)**
   - Open `lib/prompt-guard.ts` + `docs/security.md`.
   - "Every query runs through a prompt guard. We log attempts to override instructions and can hard block risky patterns. Docs spell out hardening steps for compliance."

6. **Wrap (3:30–3:45)**
   "So you get a finance/policy assistant that's fast, cheap, observable, and has prompt-injection defenses built in."

---

## Upwork Service – Secure RAG Assistant for Finance/Policy Teams

Use this as a service description:

"In two weeks I'll deliver a secure, metrics-rich Retrieval-Augmented Generation assistant tailored to finance and compliance teams. You provide sample documents—earnings transcripts, audit policies, SOP PDFs—and API keys for OpenAI plus Supabase (or another vector DB). I handle ingestion pipelines, dedupe hashing, and tuned vector search so your analysts can ask board-level questions with citations in under ~1.2 seconds.

Engagement phases:
- Days 1–2: discovery.
- Days 3–5: ingestion/indexing.
- Days 6–8: LLM orchestration + observability.
- Days 9–10: performance/security hardening.
- Days 11–14: handoff and enablement.

Deliverables: finance and policy CLI demos, `/api/answer` with prompt-guard logging, `/api/admin/metrics` plus `npm run metrics:summary`, architecture & performance docs, and a runbook. Success metrics: sub-second-ish latency, <1% guard blocks, per-query cost tracking, and stakeholders able to self-serve both demo flows without engineering support."

---

## Technical Summary Snippet

Use in README / proposals:

"The system is a Next.js-based RAG engine: tsx scripts ingest markdown/PDF corpora, chunk with configurable overlap, dedupe via HMAC hashes, and store embeddings in Supabase pgvector (or another vector DB). Retrieval uses a stored `match_documents` RPC, while `/api/answer` handles rate limiting, prompt-injection detection, embedding generation, answer synthesis with GPT-4o mini, and citation assembly. Every request is instrumented by `RagMetricsTracker`, which feeds both the metrics CLI and `/api/admin/metrics`. Security and observability are first-class: hashed query logs, configurable prompt guard, and `docs/security.md` for hardening steps."
