#!/usr/bin/env tsx
/**
 * Document Ingestion Pipeline
 *
 * Process:
 * 1. Read /data/*.{md,txt} files
 * 2. Chunk using recursive text splitter (1000 chars, 200 overlap)
 * 3. Compute chunk_hash = SHA-256(source_url + content)
 * 4. Generate embeddings via OpenAI (batch of 100)
 * 5. Upsert to Supabase with embedding_model + embedding_date
 *
 * Usage:
 *   npm run ingest
 *   tsx scripts/ingest.ts
 */

import fs from 'fs';
import path from 'path';
import { getSupabaseClient, RagDocumentInsert } from '../lib/supabase/client';
import { generateEmbeddingsBatch, EMBEDDING_MODEL } from '../lib/openai/embeddings';
import { chunkText, preprocessText } from '../lib/utils/chunk';
import { hashChunk } from '../lib/utils/hash';

const DATA_DIR = path.join(process.cwd(), 'data');

interface Chunk {
  source_url: string;
  content: string;
  chunk_hash: string;
}

/**
 * Main ingestion pipeline
 */
async function main() {
  console.log('🚀 Starting document ingestion...\n');

  // 1. Read all files from /data directory
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.txt'));

  if (files.length === 0) {
    console.error('❌ No .md or .txt files found in /data directory');
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} files to ingest:`);
  files.forEach((f) => console.log(`   - ${f}`));
  console.log();

  // 2. Chunk all documents
  const allChunks: Chunk[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceUrl = `data/${file}`;

    console.log(`📄 Processing ${file}...`);

    // Preprocess and chunk
    const processedText = preprocessText(content);
    const chunks = chunkText(processedText, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    console.log(`   ✓ Created ${chunks.length} chunks`);

    // Create chunk objects with hashes
    for (const chunk of chunks) {
      const chunkHash = hashChunk(sourceUrl + chunk);
      allChunks.push({
        source_url: sourceUrl,
        content: chunk,
        chunk_hash: chunkHash,
      });
    }
  }

  console.log(`\n📊 Total chunks: ${allChunks.length}\n`);

  // 3. Generate embeddings in batches
  console.log('🤖 Generating embeddings via OpenAI...');
  const texts = allChunks.map((c) => c.content);
  const embeddings = await generateEmbeddingsBatch(texts, 100);

  if (embeddings.length !== allChunks.length) {
    throw new Error('Embedding count mismatch');
  }

  console.log(`   ✓ Generated ${embeddings.length} embeddings\n`);

  // 4. Prepare documents for upsert
  const embeddingDate = new Date().toISOString().split('T')[0]; // ISO date (YYYY-MM-DD)
  const documents: RagDocumentInsert[] = allChunks.map((chunk, idx) => ({
    source_url: chunk.source_url,
    chunk_hash: chunk.chunk_hash,
    content: chunk.content,
    embedding: embeddings[idx],
    embedding_model: EMBEDDING_MODEL,
    embedding_date: embeddingDate,
  }));

  // 5. Upsert to Supabase
  console.log('💾 Upserting to Supabase...');
  const supabase = getSupabaseClient(true); // Use service role for writes

  // Upsert in batches of 100 (Supabase limit)
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('rag_docs')
        .upsert(batch, { onConflict: 'chunk_hash' });

      if (error) {
        console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(
          `   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} upserted (${batch.length} docs)`
        );
      }
    } catch (error) {
      console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} exception:`, error);
      errorCount += batch.length;
    }
  }

  console.log(`\n✅ Ingestion complete!`);
  console.log(`   Success: ${successCount} documents`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount} documents`);
  }
}

// Run main and handle errors
main().catch((error) => {
  console.error('\n❌ Ingestion failed:', error);
  process.exit(1);
});
