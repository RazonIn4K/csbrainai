# Policy & Compliance Q&A Example

Demonstrate how this engine handles regulated content (security policies, SOC2 controls, privacy SOPs) with a ready-to-run CLI workflow.

## Prerequisites

1. Copy `.env.example` → `.env` (or `.env.local`) and provide:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Drop PDF policies under `examples/policy_compliance_assistant/policies/` (or update the path in `config.ts`).

## Configuration

Edit `examples/policy_compliance_assistant/config.ts` to customize:
- `pdfDirectory`: point to any folder of compliance PDFs.
- `chunkSize`, `chunkOverlap`, `minChunkLength`: tune splitting for dense or sparse policies.
- `questions`: curated prompts that run when no CLI question is provided.
- `matchCount`, `matchThreshold`: retrieval sensitivity defaults.

Once configured, swapping to a new policy set is as easy as updating the folder path and question list—no code changes.

## 1. Ingest compliance PDFs

```bash
npm run policy:ingest
```

- Reads every PDF in the configured directory
- Chunks, hashes, embeds, and upserts into Supabase
- Safe to re-run nightly thanks to deterministic `chunk_hash`

Override the folder at runtime:

```bash
npm run policy:ingest -- ./client-policies
```

## 2. Ask compliance questions

```bash
npm run policy:ask
```

- Runs the curated questions defined in `config.ts`
- Prints structured answers + citations per chunk
- Supply a one-off question via CLI:

```bash
npm run policy:ask -- "Which roles can approve production access?"
```

This mirrors the finance workflow so clients can self-serve: clone → `.env` → drop policies → run ingest → run questions.
