# Upwork Project Draft: RAG Assistant for Your Documents

Position this as a turnkey 2-week engagement. Copy/paste-friendly for Project Catalog listings.

## Package Overview

| Tier | Price (suggested) | Scope |
| --- | --- | --- |
| Basic | $3,500 | Single data source (markdown or PDFs), Supabase vector DB, finance demo | 
| Standard | $6,500 | Finance + policy/compliance assistants, prompt guard, metrics dashboard | 
| Premium | $9,500 | Multi-tenant ingestion, custom prompt library, executive report & enablement sessions |

Timeline: 2 weeks total regardless of tier (scope varies by deliverables). Engagement includes async access via Slack/Teams plus two milestone calls.

## Input Requirements

- **Document formats:** Markdown, TXT, PDF transcripts/policies. Client supplies at least 3 samples per source.
- **Volume:** Up to 5,000 chunks (≈3M tokens) included; higher volumes quoted separately.
- **Security constraints:** Clarify if data must stay in VPC / on-prem. Provide API keys (OpenAI/Supabase/Pinecone) via secure vault.
- **Stakeholders:** Identify business owner + security/IT reviewer to approve prompt guard settings.

## Deliverables by Tier

### Basic
- Supabase-backed ingestion pipeline (`npm run ingest`) wired to client docs
- GPT-4o mini answer endpoint with privacy-safe logging
- Finance-style CLI demo + quickstart README
- Handoff call with architecture diagram + cost report

### Standard
- Everything in Basic
- Policy/compliance assistant (`npm run policy:*`) with configurable question packs
- Prompt-guard configuration + security checklist
- `/api/admin/metrics` endpoint + `npm run metrics:summary` runbook
- Case studies + performance tuning guide for internal rollout

### Premium
- Everything in Standard
- Multi-environment deployment (staging + prod) with CI hooks
- Custom LLM prompt packs (sales, support, audit) + evaluation harness
- Executive-ready deck: architecture, KPIs, roadmap, and ROI narrative

## Success Metrics
- < 1.2s median latency for top-5 retrievals
- < 1% prompt-guard block rate (logged + reviewable)
- Cost per query tracked and forecasted (< $0.01 avg for GPT-4o mini tier)
- Stakeholders able to run both finance & policy demos without engineering help

Use this script in outreach: “In 2 weeks I deliver a secure, metrics-rich RAG assistant for your documents. You bring the PDFs and API keys, I handle ingestion, guardrails, and handoff.”
