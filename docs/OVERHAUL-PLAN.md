# CSBrainAI Overhaul Plan

Date: 2026-06-09
Status: Active
Role in portfolio strategy: **privacy-first RAG product demo for technical teams.
The substance already exists — the work is surfacing hidden assets (vertical lanes,
evals, privacy model) as visible product pages, not building new capability.**
Cross-repo governance: see `E:\Codebases\PORTFOLIO-OVERHAUL-MASTER-PLAN.md`.

---

## Current diagnosis (verified against the repo, with file references)

Technically credible core, nearly invisible product surface:

- **Web app is a single page**: `app/page.tsx` (33 lines) mounting
  `components/AnswerDemo.tsx` (504 lines). Copy: "Privacy-First RAG System —
  Powered by Supabase + pgvector | OpenAI | Sentry."
- **API**: `POST /api/answer` (`app/api/answer/route.ts`) — hashes the query
  immediately (line ~104), prompt-injection guard, rate limit, returns
  `{ answer, citations[], q_hash, q_len, tokensUsed }`; GET serves API docs.
  Plus `app/api/admin/metrics/route.ts`.
- **Hidden vertical lanes (CLI-only today)**:
  - Finance: `examples/pdf_finance_assistant/` — PDF ingestion (1600-char chunks,
    200 overlap, min 200), `npm run finance:ingest` / `finance:ask`, curated
    questions (revenue guidance, risk factors, capital allocation), cited answers
    with similarity scores.
  - Policy/compliance: `examples/policy_compliance_assistant/` — config-driven
    (`config.ts`: 1200/150/180 chunking, 6 matches @ 0.55 threshold), `policy://`
    source scheme, questions on retention, access controls, breach escalation.
- **Real evals harness**: `scripts/evals-runner.ts` + 20-question corpus
  (`data/evals/test-questions.jsonl`); scoring weights 40% keyword match / 30%
  citations / 20% non-empty / 10% latency<5s; fails below 50% overall; nightly
  GitHub Actions run producing `eval-results.json` + `eval-summary.txt`;
  `npm run metrics:summary` CLI over `lib/metrics-store.ts`.
- **Privacy model implemented, documented, untested by visitors**:
  `lib/crypto-utils.ts` (HMAC-SHA256 `hashQuery`, salted, 64-hex), `lib/sentry-utils.ts`
  (recursive PII scrubbing, header stripping), `lib/rate-limiter.ts` (token bucket,
  10 req/min, in-memory only), `docs/PRIVACY.md` (363 lines: threat model,
  GDPR/CCPA/HIPAA notes, audit checklist, incident response).
- **Docs are rich**: `docs/architecture.md`, `SCHEMA.md` (rag_docs table, IVFFlat,
  cosine similarity), `ANSWER-FLOW.md`, `INGEST.md`, `GO-LIVE-GATE.md`,
  `performance.md`, `security.md`, `case-studies.md`, `demo_runbook.md`.

The problems:

1. **`README.md:79` frames the repo as an Upwork portfolio item** ("This repo is
   part of my Upwork portfolio…") — portfolio framing that undercuts product
   positioning. Upwork collateral belongs only in `docs/upwork/`.
2. **No CLAUDE.md** — the only repo of the four without one.
3. **The best proof (verticals, evals, privacy) lives in scripts and docs**, not on
   any page a visitor can see.
4. ~~Repo is 3 commits behind origin/main~~ — resolved 2026-06-09
   (fast-forwarded; the pull also brought `examples/simple_rag/`).

### Stack
Next.js 16 (App Router), TypeScript 5, Supabase + pgvector (1536-dim,
text-embedding-3-small), gpt-4o-mini generation, Sentry, optional Upstash, Jest +
Vitest, pdf-parse, Zod.
Scripts: `ingest`, `finance:ingest/ask`, `policy:ingest/ask`, `metrics:summary`,
`evals`, `test`, `test:vitest`, `type-check`, `lint`, `build`.

---

## Goal

```text
CSBrainAI = privacy-first RAG workbench for technical teams
```

Not: an Upwork portfolio item, a general CS learning app, a High Encode content
site, or a David personal project directory.

Primary user: technical teams that need internal knowledge assistants.
Primary CTA: try/read the private RAG demo lanes; inspect the trust model.

The differentiator to make visible: not "AI answers," but **answers with citations,
no raw query storage, eval scoring, and operational guardrails.**

---

## PR plan

### PR C1 — Product boundary + README cleanup + CLAUDE.md  (Week 1, small)

1. Remove the Upwork-portfolio line from `README.md:79`; keep that copy only in
   `docs/upwork/`. Reframe the README opening strictly as product positioning
   (the existing "queries are never stored in raw form" thesis is the right lead).
2. Add `CLAUDE.md` covering: stack, scripts (especially the vertical lanes and
   evals), privacy invariants (HMAC-only logging — never log raw queries), and a
   pointer to the boundary doc.
3. Add `docs/BRAND-BOUNDARY.md`:

```md
# CSBrainAI Brand Boundary

## This property is
- A privacy-first RAG workbench for technical teams.
- A product demo for cited answers, private telemetry, evals, and retrieval
  architecture.

## This property is not
- A learning platform.
- A personal portfolio.
- A prompt injection scanner.
- A High Encode service page.

## Primary user
Technical teams that need internal knowledge assistants.

## Primary CTA
Try/read the demo lanes; inspect the privacy model, evals, and architecture.

## Cross-link rule
- One "Built by David Ortiz" credit is allowed (links to davidtiz.com).
- No ecosystem navigation. Upwork/sales collateral stays in docs/upwork/.
```

### PR C2 — Expose the vertical demo lanes  (Week 2)

The scripts already imply three lanes; build **static pages first** — rendered
transcripts of real `finance:ask` / `policy:ask` runs are enough for v1. Do not
wait for a multi-tenant backend.

Routes (App Router pages):

```text
/examples            lane index
/examples/policy     policy & compliance assistant   ← lead with this (see C4)
/examples/finance    PDF finance assistant
/examples/cs         the existing CS knowledge demo (links to the live AnswerDemo)
```

Each lane page includes:

```text
Use case                  who this lane is for
Knowledge source type     PDFs / markdown corpus
Chunking + retrieval      e.g. policy: 1200-char chunks, 150 overlap, min 180,
                          6 matches @ 0.55 threshold (from examples/.../config.ts)
Question set              the curated questions the lane ships with
Sample answer             a real captured run, with citations + similarity scores
Privacy/logging behavior  q_hash + q_len only; source-URL scheme (policy://, file://)
How to run locally        npm run policy:ingest && npm run policy:ask "…"
```

Source material: `examples/pdf_finance_assistant/`,
`examples/policy_compliance_assistant/`, `data/evals/`.

### PR C3 — Trust console  (Week 3 — mostly docs→pages conversion)

```text
/privacy-model    from docs/PRIVACY.md + the implementation story:
                  what is logged (q_hash, q_len, latency, tokens, cost, citation
                  count) vs what is NEVER logged (raw queries, PII, sessions,
                  fingerprints); HMAC-SHA256 hashing (lib/crypto-utils.ts);
                  Sentry scrubbing rules (lib/sentry-utils.ts); threat model;
                  compliance notes (GDPR/CCPA/HIPAA considerations)

/evals            the 20-question corpus; scoring weights (40/30/20/10);
                  pass threshold (≥50%); nightly CI explanation; latest
                  eval-summary numbers — a page showing REAL recent eval scores
                  is the credibility move

/architecture     from docs/architecture.md + docs/SCHEMA.md:
                  Supabase pgvector, rag_docs schema, IVFFlat index, cosine
                  similarity, embedding model, retrieval thresholds, answer
                  generation flow, citation construction
```

Keep these pages in sync with the docs by treating docs as the source of truth and
pages as the rendered summary (or render the markdown directly).

### PR C4 — Buyer-focused homepage  (Week 3)

Current homepage copy is clear but general. Lead with the strongest buyer — and the
**policy/compliance lane maps to paying teams better than CS Q&A**, so it goes first.

```text
Hero      Private RAG workbench for technical teams.
          Cited answers without storing raw user questions.

Proof     citations · hashed-query telemetry · eval harness · pgvector retrieval

Demo      /examples/policy   /examples/finance   /examples/cs
lanes

Trust     /privacy-model   /evals   /architecture
console

Footer    Built by David Ortiz.   (single credit, links to davidtiz.com)
```

Keep the live AnswerDemo as the interactive element (on the homepage or `/examples/cs`).

### PR C5 — Hosted-demo hardening  (optional, only if/when publicly promoted)

```text
rate limiting (already: 10 req/min token bucket — verify it holds under promotion)
example-only mode (no raw document upload from visitors)
seeded demo data per lane
clear privacy copy at the point of input
cost guardrails (per-day token/cost cap on /api/answer)
```

---

## What NOT to do in this repo

- Do not turn it into a learning platform or blog — that is High Encode's lane.
- Do not add ecosystem navigation or links to High Encode / Prompt Defenders.
- Do not weaken the privacy invariants for demo convenience: raw queries are never
  logged, period — that promise IS the product.
- Do not build a multi-tenant upload backend before the static lane pages prove
  interest (C2 explicitly ships static first).

## Done criteria for this repo

- [x] README opens as product positioning; Upwork framing confined to docs/upwork/. (PR #15)
- [x] CLAUDE.md and docs/BRAND-BOUNDARY.md exist. (PR #15)
- [x] /examples/policy, /examples/finance, /examples/cs live (PR #16) — **real
      captured runs still pending**: transcript slots in app/examples/lanes.ts
      render an honest pending state until the production incident
      (docs/OPERATIONS.md) is resolved and real CLI runs are pasted in.
- [x] /privacy-model, /evals, /architecture live (PR #18) — **/evals shows a
      pending-scores state**, not real scores, until the nightly pipeline has a
      successful run again.
- [x] Homepage leads with "private RAG workbench for technical teams" and the
      policy lane. (PR #19)
- [ ] Gates green: lint, type-check, jest + vitest, build all pass locally and
      on Vercel; **evals ≥ threshold is blocked** on the open production
      incident (docs/OPERATIONS.md).
