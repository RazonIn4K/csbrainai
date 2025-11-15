# PDF Finance Assistant Example

Premium buyers want a turnkey workflow. This example shows exactly how to go from PDFs → finance Q&A without touching the Next.js app.

## Prerequisites

1. Duplicate `.env.example` into `.env` (or fill `.env.local`) with:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Place quarterly earnings PDFs inside `examples/pdf_finance_assistant/pdfs/`.

Environment variables are auto-loaded by the helper, so you can simply run the scripts below once `.env` is present.

## 1. Ingest transcripts

```bash
npm run finance:ingest
```

- Parses every PDF in `pdfs/`
- Chunks into ~1.6k character segments with overlap
- Embeds via OpenAI and upserts into Supabase with deduped hashes

You can point to a different folder by passing an absolute or relative path:

```bash
npm run finance:ingest -- ./my-transcripts
```

## 2. Ask finance-grade questions

```bash
npm run finance:ask
```

- Runs three curated example questions covering revenue, risks, and capital allocation
- Streams the answer plus citations directly in the terminal
- Pass a custom question by appending it after the script command:

```bash
npm run finance:ask -- "Where are we seeing margin compression?"
```

This end-to-end flow is intentionally CLI-first so you can demo "clone + .env + run example" without touching front-end code.
