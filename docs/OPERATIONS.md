# Operations — Production API Recovery Runbook

Status: **OPEN INCIDENT** — production `/api/answer` returns 500 on every query.
Opened: 2026-06-09. Update this section when resolved.

## Incident summary

`POST https://csbrainai.vercel.app/api/answer` returns `500 internal_error` on
every valid query. Confirmed 2026-06-09:

```bash
curl -X POST https://csbrainai.vercel.app/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query":"What is RAG?"}'
# -> 500 {"error":{"type":"internal_error","message":"Failed to generate answer..."}}
```

## What is and is not broken (probed 2026-06-09)

| Probe | Result | Meaning |
| --- | --- | --- |
| `GET /api/answer` | 200, serves API docs | Deployment boots; route handler healthy |
| `POST` with 2-char query | 400 validation error | Request parsing + Zod validation work |
| `POST` with valid query | 500 `internal_error` | Failure is **after validation**, inside hash → embed → retrieve → generate |
| `GET /examples/policy` | 200 | Static pages (C2) deploy and render fine |
| Local `lint`/`type-check`/`jest`/`vitest`/`build` | all pass (2026-06-09) | **Not a code regression** — this is environment/infrastructure |

The post-validation pipeline touches, in order:
1. `hashQuery` (`lib/crypto-utils.ts`) — requires `HASH_SALT`
2. OpenAI embedding (`lib/openai.ts`) — requires valid `OPENAI_API_KEY`
3. Supabase vector search (`lib/supabase.ts`) — requires live project + valid keys
4. gpt-4o-mini generation — same OpenAI key

## How long it has been broken

GitHub Actions nightly evals (`.github/workflows/nightly-evals.yml`):

- **Failing since at least 2026-01-12** (every run 01-12 → 01-21 failed at the
  **"Build Next.js app"** step in CI — evals never executed).
- **No runs at all after 2026-01-21** — the cron schedule went dormant (GitHub
  disables scheduled workflows after ~60 days of repo inactivity, and the repo
  was quiet until June).
- There is **no successful run in the retained history**.

So the monitoring that should have caught this has itself been down since
January. Treat "production worked" as unverified for roughly five months.

## Likely causes, in order of probability

1. **Supabase project paused.** Free-tier Supabase pauses projects after ~1 week
   of inactivity; five idle months make this the prime suspect. A paused project
   refuses connections → vector search throws → 500.
2. **Expired/rotated `OPENAI_API_KEY`** in Vercel env.
3. **Env var drift in Vercel** — `HASH_SALT`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` / service-role key missing after a project change.
4. CI build failures in January suggest the same secrets are stale in GitHub
   Actions secrets too (the build step there consumes env).

## Remote diagnosis update (2026-06-10) — timing evidence reorders the suspects

Probed production from outside (no credentials needed):

- `POST /api/answer` with a valid query → **500 in 0.44–0.89s total**, three
  samples, *including* network round-trip. Response body is the sanitized
  generic error (good PII hygiene, by design).
- Code-level failure-mode check of the chain (`app/api/answer/route.ts`):
  - `hashQuery` → `generateHMAC` (`lib/crypto-utils.ts:11-14`) **throws
    instantly** if `HASH_SALT` is unset — zero external calls.
  - `generateEmbedding` → `getOpenAIClient` (`lib/openai.ts:13-17`) **throws
    instantly** if `OPENAI_API_KEY` is unset; an expired key 401s in
    ~200–400ms.
  - A paused-Supabase failure can only occur **after** a successful embedding
    call (~300–800ms of OpenAI latency alone), which would push total response
    time well above what was observed.

**Conclusion: the 500 almost certainly fires at or before the first external
call — missing `HASH_SALT`, missing `OPENAI_API_KEY`, or an expired OpenAI
key. The request very likely never reaches Supabase.** Supabase may *also* be
paused after five idle months (it still matters for retrieval), but it is not
the immediate cause of this error.

Practical effect on the checklist below: do step 1 (Sentry — the exception
name will literally distinguish `HASH_SALT … required` vs
`OpenAIConfigurationError` vs a 401), then do step **3 (Vercel env vars)
before step 2 (Supabase)**.

## Recovery checklist (requires owner credentials — cannot be done by an agent)

1. **Read the real stack trace first**: check Sentry for events from
   `/api/answer` (server-side errors are captured with PII scrubbing). This
   likely names the failing stage outright and may save the rest of the list.
2. **Supabase console**: confirm the project is active (unpause/restore if
   paused). Then verify:
   - `rag_docs` table exists with rows (`select count(*) from rag_docs;`)
   - pgvector extension enabled; IVFFlat index present (see `docs/SCHEMA.md`)
   - the match/similarity RPC the app calls still exists
3. **Vercel dashboard → csbrainai → Settings → Environment Variables**: confirm
   all of these are present and current for Production:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (and service-role key if the server uses it)
   - `OPENAI_API_KEY`
   - `HASH_SALT`
   - `SENTRY_DSN` (optional but wanted)
   - Upstash vars if Redis rate limiting is enabled
4. **Validate the OpenAI key** independently (one-line models list call).
5. **Redeploy** (Vercel → Redeploy latest) so new env values take effect.
6. **Verify**:

   ```bash
   curl -X POST https://csbrainai.vercel.app/api/answer \
     -H "Content-Type: application/json" \
     -d '{"query":"What is RAG?"}'
   # expect: 200 with answer + citations[] + q_hash
   ```

7. **Update GitHub Actions secrets** with the same refreshed values, then
   re-enable and run the nightly workflow:

   ```bash
   gh workflow enable nightly-evals.yml
   gh workflow run nightly-evals.yml
   ```

   Confirm it reaches "Run evaluations" and scores ≥ 50%.
8. **Close this incident**: flip the Status line above to RESOLVED with the date
   and one line on the root cause.

## Prevention

- **Uptime check on the POST path, not just GET.** A pinger on `GET /` would
  have shown green this whole time. Add a synthetic `POST /api/answer` check
  (any 3+ char query; assert 200) in an uptime service or a scheduled action.
- **Keep the nightly evals cron alive.** GitHub disables idle crons; a monthly
  no-op commit or a `workflow_dispatch`-based external trigger avoids silent
  death. At minimum, check the Actions tab when returning to the repo after a
  break.
- **Mind Supabase free-tier pausing**: if the project must stay demo-live, a
  weekly scheduled query (the nightly evals themselves, once green) keeps it
  awake.
- Before marketing the hosted demo as live (see C4/C5 in
  `docs/OVERHAUL-PLAN.md`), this runbook must be green end to end.
