#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

import { hydrateEnv, resolveExamplePath } from '../shared/env';
import { policyExampleConfig } from './config';
import { generateEmbedding, EMBEDDING_MODEL } from '../../lib/openai';
import { generateHMAC } from '../../lib/crypto-utils';
import { upsertDocument } from '../../lib/supabase';

hydrateEnv();

interface ChunkJob {
  content: string;
  sourceUrl: string;
}

const DEFAULT_POLICY_DIR = resolveExamplePath('policy_compliance_assistant', 'policies');
const CHUNK_SIZE = policyExampleConfig.chunkSize ?? 1200;
const CHUNK_OVERLAP = policyExampleConfig.chunkOverlap ?? 150;
const MIN_CHUNK_LENGTH = policyExampleConfig.minChunkLength ?? 180;

function chunkPolicy(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  if (!normalized) {
    return chunks;
  }

  for (let start = 0; start < normalized.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = normalized.slice(start, Math.min(start + CHUNK_SIZE, normalized.length)).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }
    if (start + CHUNK_SIZE >= normalized.length) {
      break;
    }
  }

  return chunks;
}

async function readPdf(filePath: string): Promise<string> {
  const file = await fs.readFile(filePath);
  const parsed = await pdf(file);
  return parsed.text;
}

async function toChunkJobs(filePath: string): Promise<ChunkJob[]> {
  const text = await readPdf(filePath);
  const chunks = chunkPolicy(text);
  const fileName = path.basename(filePath);

  return chunks.map((content, idx) => ({
    content,
    sourceUrl: `policy://${fileName}#chunk-${idx}`,
  }));
}

async function ingestPolicies(pdfDir: string) {
  const dir = path.resolve(pdfDir);
  const exists = await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error(`Policy directory not found: ${dir}`);
  }

  const files = (await fs.readdir(dir)).filter((file) => file.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    console.warn(`No policy PDFs detected in ${dir}. Drop your compliance PDFs there and re-run.`);
    return;
  }

  console.log(`📁 Ingesting ${files.length} compliance policy PDF(s) from ${dir}`);

  let processed = 0;
  for (const fileName of files) {
    const absolutePath = path.join(dir, fileName);
    console.log(`\n➡️  Processing ${fileName}`);
    const jobs = await toChunkJobs(absolutePath);
    console.log(`   - Prepared ${jobs.length} policy chunks`);

    for (const job of jobs) {
      const chunkHash = generateHMAC(job.content);
      const embedding = await generateEmbedding(job.content);

      await upsertDocument({
        source_url: job.sourceUrl,
        chunk_hash: chunkHash,
        content: job.content,
        embedding,
        embedding_model: EMBEDDING_MODEL,
        embedding_date: new Date().toISOString(),
      });

      processed += 1;
    }

    console.log(`   - Stored ${jobs.length} chunks in Supabase.`);
  }

  console.log(`\n✅ Policy ingestion complete. Total chunks written: ${processed}`);
}

async function main() {
  const cliDir = process.argv[2];
  const configuredDir = policyExampleConfig.pdfDirectory || DEFAULT_POLICY_DIR;
  const targetDir = path.resolve(cliDir || configuredDir || DEFAULT_POLICY_DIR);
  await ingestPolicies(targetDir);
}

main().catch((error) => {
  console.error('Policy ingestion failed:', error);
  process.exit(1);
});
