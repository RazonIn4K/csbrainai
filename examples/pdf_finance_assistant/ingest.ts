#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

import { hydrateEnv, resolveExamplePath } from '../shared/env';
import { generateEmbedding, EMBEDDING_MODEL } from '../../lib/openai';
import { generateHMAC } from '../../lib/crypto-utils';
import { upsertDocument } from '../../lib/supabase';

hydrateEnv();

const DEFAULT_FINANCE_DIR = resolveExamplePath('pdf_finance_assistant', 'pdfs');

interface ChunkJob {
  content: string;
  sourceUrl: string;
}

function chunkTranscript(text: string, chunkSize = 1600, overlap = 200): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];

  if (!normalized) return chunks;

  for (let start = 0; start < normalized.length; start += chunkSize - overlap) {
    const chunk = normalized.slice(start, Math.min(start + chunkSize, normalized.length)).trim();
    if (chunk.length > 200) {
      chunks.push(chunk);
    }
    if (start + chunkSize >= normalized.length) {
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

async function buildChunksFromPdf(filePath: string): Promise<ChunkJob[]> {
  const text = await readPdf(filePath);
  const chunks = chunkTranscript(text);
  const fileName = path.basename(filePath);

  return chunks.map((content, index) => ({
    content,
    sourceUrl: `file://${fileName}#chunk-${index}`,
  }));
}

async function ingestPdfDirectory(pdfDir: string) {
  const exists = await fs
    .access(pdfDir)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error(`PDF directory not found: ${pdfDir}`);
  }

  const files = (await fs.readdir(pdfDir)).filter((file) => file.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    console.info(`No PDF transcripts detected in ${pdfDir}. Place finance call transcripts there first.`);
    return;
  }

  console.log(`📁 Preparing to ingest ${files.length} PDF transcript(s) from ${pdfDir}`);

  let processed = 0;
  for (const fileName of files) {
    const absolutePath = path.join(pdfDir, fileName);
    console.log(`\n➡️  Processing ${fileName}`);
    const jobs = await buildChunksFromPdf(absolutePath);
    console.log(`   - Generated ${jobs.length} finance-specific chunks`);

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

    console.log(`   - Successfully upserted ${jobs.length} chunks.`);
  }

  console.log(`\n✅ Finance transcripts ready. Total chunks written: ${processed}`);
}

async function main() {
  const inputDir = process.argv[2];
  const targetDir = path.resolve(inputDir || DEFAULT_FINANCE_DIR);
  await ingestPdfDirectory(targetDir);
}

main().catch((error) => {
  console.error('PDF ingestion failed:', error);
  process.exit(1);
});
