# Case Studies

## 1. Finance Earnings Q&A Assistant

**Problem:** FP&A team needed a way to mine quarterly earnings PDFs for guidance shifts without analysts spending hours per transcript. Existing portals lacked question-level traceability for auditors.

**Approach:** We ingested CFO and CEO transcripts through the `examples/pdf_finance_assistant` pipeline, deduped via HMAC hashes, and tuned retrieval (`k=5`, threshold 0.5) for high recall. A curated CLI question set showcased board-ready answers while `/api/answer` kept hashed logs only.

**Tech Stack:** Next.js API on Node, OpenAI `text-embedding-3-small` + `gpt-4o-mini`, Supabase pgvector (`match_documents` RPC), tsx CLI runners, Sentry logging, RagMetrics tracker.

**Outcomes:** Stakeholders now run `npm run finance:ask` live during earnings prep to surface guidance deltas with citations under 1.2s. Compliance teams leverage `/api/admin/metrics` for instant SLA proof.

## 2. Policy & Compliance Copilot

**Problem:** Security operations had hundreds of PDF policies spread across SharePoint. Auditors kept asking "where does it say that?" and engineers struggled to map questions to the right policy revision.

**Approach:** Built the `examples/policy_compliance_assistant` flow pointing at `policies/` folders plus a config file for quick question swaps. Prompt-guard logging flagged attempts to coerce system prompts, and a metrics summary CLI gave leadership fast visibility during tabletop exercises.

**Tech Stack:** Same shared ingestion, OpenAI embedding + chat models, Supabase vectors, prompt guard hook (`PROMPT_GUARD_MODE`), metrics persistence to `.rag-metrics-log.jsonl`, CLI summary (`npm run metrics:summary`).

**Outcomes:** Compliance managers can drop new PDFs, re-run `npm run policy:ingest`, and answer access-control questions with citations in minutes. The prompt guard plus metrics demo satisfied internal security review, clearing the path for production rollout.
