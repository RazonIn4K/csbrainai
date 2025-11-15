# Performance & Tuning Guide

This guide captures the levers to reach sub-second answers for enterprise RAG deals.

## 1. Index Choices

| Workload | Recommended Index | Notes |
| --- | --- | --- |
| Fast prototype / single tenant | Supabase `pgvector` (ships with repo) | Use `ivfflat` with `lists=100` once you have > 50k chunks. Reindex after large ingests. |
| Latency-critical (>1M chunks) | Pinecone Serverless or Weaviate | Mirror the `rag_docs` schema – include `chunk_hash` for dedupe + metadata filters. |
| Edge deployments / air-gapped | Chroma or LanceDB embedded | Run ingestion scripts with `--adapter` flag (extend `scripts/ingest.ts`) and persist to disk. |

**Tip:** keep embeddings consistent across stores (currently `text-embedding-3-small`). Swapping in larger models only helps if documents are long-form and you can afford the cost.

## 2. Chunking Strategy

- **Chunk size:** default finance pipeline uses ~1.6k characters (~450 tokens). Increase to 2k when documents are narrative (transcripts) or shrink to ~800 for short FAQs.
- **Overlap:** keep 10–15% overlap (200 chars in example) to avoid truncating answers mid-thought.
- **Deduplication:** `generateHMAC` keeps identical chunks from re-ingesting. Hash is stable so you can safely re-run nightly jobs.

The finance ingest script exposes the chunker – adjust `chunkTranscript` parameters or swap to a semantic splitter if transcripts have speaker metadata.

## 3. Vector Search Parameters

- `matchCount (k)`: default `5`. Increase to `8-10` when answers require cross-document synthesis; reduce to `3` for ultra-low latency chat endpoints.
- `matchThreshold`: `0.5` balances recall and noise for finance transcripts. Raise toward `0.65` when documents are homogenous (e.g., policies) to avoid hallucinations.
- Filters: add columns (e.g., `ticker`, `filing_date`) to `rag_docs` and propagate them through `searchDocuments` to hard-scope retrieval for multi-tenant deployments.

## 4. Latency Measurement & Alerting

`lib/metrics.ts` tracks:
- `endToEndMs`: time from API hit to answer payload
- `vectorSearchMs`: Supabase RPC roundtrip
- `chunksReturned`: # of documents passed to the LLM
- `costUsd`: optional per-query cost estimated via `ai-utils.estimate_llm_cost`

Metrics are emitted as structured console logs plus Sentry breadcrumbs, so you can hook Datadog, Honeycomb, or OpenTelemetry forwarders without touching business logic.

Recommended targets for a premium pitch:
- Vector search < 300 ms (Supabase) / < 120 ms (Pinecone)
- End-to-end < 1.2 s for 5 chunks / GPT-4o mini
- Alert when `chunksReturned` suddenly drops to 0 → content pipeline issue

## 5. Tuning Workflow

1. **Instrument:** run `npm run dev` and `npm run finance:ask` to capture baseline metrics.
2. **Adjust chunk size/overlap** in `examples/pdf_finance_assistant/ingest.ts` and re-ingest.
3. **Re-evaluate** `matchCount` + `matchThreshold` in both `app/api/answer/route.ts` and `examples/pdf_finance_assistant/ask.ts`.
4. **Record** before/after metrics; clients love screenshots of improvement tables.

With these guardrails you can commit to "RAG system delivered in 2 weeks" and have a repeatable playbook.

## 6. Cost Tracking

- The API attempts to load `ai-utils.estimate_llm_cost` and, when present, records `costUsd` for every answer.
- `npm run metrics:summary` now prints average cost per query; `/api/admin/metrics` exposes the same JSON field for dashboards.
- Use `RAG_METRICS_LOG_PATH` to persist logs on shared servers, then line up spend charts against latency.

**Example cost planning (assuming GPT-4o mini, 800 prompt tokens, 200 completion tokens):**

| Workload | Queries / day | Avg cost / query | Est. monthly cost | Notes |
| --- | --- | --- | --- | --- |
| Pilot team | 250 | $0.006 | ~$45 | Finance transcripts only |
| Enterprise helpdesk | 1,000 | $0.0075 | ~$228 | Includes compliance policies |
| Exec copilot | 3,000 | $0.009 | ~$810 | Higher completion tokens for narrative summaries |

Stretch goal: keep per-query costs below $0.01 while staying <1.2s latency.

## 7. Performance Demo

- Run `npm run metrics:summary` to print a terminal-friendly health check (avg latency, vector time, error rate, chunk count, cost). This reads `.rag-metrics-log.jsonl` which is written automatically every time `/api/answer` is called.
- Hit `GET /api/admin/metrics` (optionally gated by `METRICS_ADMIN_TOKEN`) for JSON output you can drop into Postman or curl during audits.
- Pair the finance/policy CLI demos with the metrics summary to show execs both qualitative answers and quantitative SLAs in under a minute.
