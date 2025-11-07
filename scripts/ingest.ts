#!/usr/bin/env tsx

/**
 * RAG Ingestion Script
 *
 * This script:
 * 1. Reads all .md and .txt files from the data/knowledge directory
 * 2. Chunks content into paragraphs (~500 tokens)
 * 3. Generates HMAC-SHA256 hash for each chunk (for deduplication)
 * 4. Creates embeddings using OpenAI text-embedding-3-small
 * 5. Upserts chunks to Supabase (skips duplicates via chunk_hash)
 *
 * Usage: npm run ingest
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateEmbedding, EMBEDDING_MODEL } from '../lib/openai';
import { upsertDocument } from '../lib/supabase';
import { generateHMAC } from '../lib/crypto-utils';

const DATA_DIR = path.join(process.cwd(), 'data', 'knowledge');

interface Chunk {
  content: string;
  sourceUrl: string;
}

/**
 * Simple paragraph-based chunking
 * Splits on double newlines and filters out empty chunks
 */
function chunkText(text: string, maxLength: number = 2000): string[] {
  // Split by paragraphs (double newline)
  const paragraphs = text.split(/\n\s*\n/);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph exceeds max length, save current chunk
    if (currentChunk && (currentChunk.length + trimmed.length > maxLength)) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
  }

  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 50); // Filter out tiny chunks
}

/**
 * Read all markdown and text files from directory
 */
function readKnowledgeFiles(): { filePath: string; content: string }[] {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    return [];
  }

  const files = fs.readdirSync(DATA_DIR);
  const knowledgeFiles: { filePath: string; content: string }[] = [];

  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.txt')) {
      continue;
    }

    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    knowledgeFiles.push({ filePath: file, content });
  }

  return knowledgeFiles;
}

/**
 * Main ingestion function
 */
async function ingest() {
  console.log('🚀 Starting RAG ingestion...\n');

  // Read all knowledge files
  const files = readKnowledgeFiles();
  if (files.length === 0) {
    console.error('❌ No knowledge files found in', DATA_DIR);
    console.log('💡 Add .md or .txt files to data/knowledge/ directory');
    process.exit(1);
  }

  console.log(`📚 Found ${files.length} knowledge file(s)\n`);

  let totalChunks = 0;
  let processedChunks = 0;
  let skippedChunks = 0;
  let errorChunks = 0;

  for (const { filePath, content } of files) {
    console.log(`\n📄 Processing: ${filePath}`);

    // Chunk the content
    const chunks = chunkText(content);
    totalChunks += chunks.length;
    console.log(`  ├─ Chunks: ${chunks.length}`);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const sourceUrl = `file://${filePath}#chunk-${i}`;

      try {
        // Generate chunk hash for deduplication
        const chunkHash = generateHMAC(chunk);

        // Generate embedding
        const embedding = await generateEmbedding(chunk);

        // Upsert to Supabase
        await upsertDocument({
          source_url: sourceUrl,
          chunk_hash: chunkHash,
          content: chunk,
          embedding,
          embedding_model: EMBEDDING_MODEL,
          embedding_date: new Date().toISOString(),
        });

        processedChunks++;
        process.stdout.write(`  ├─ Progress: ${i + 1}/${chunks.length}\r`);
      } catch (error: any) {
        if (error.message?.includes('duplicate key')) {
          skippedChunks++;
        } else {
          console.error(`\n  ├─ Error processing chunk ${i}:`, error.message);
          errorChunks++;
        }
      }

      // Rate limiting: small delay between API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n  └─ Completed: ${filePath}`);
  }

  console.log('\n\n✅ Ingestion complete!');
  console.log(`\n📊 Summary:`);
  console.log(`  ├─ Total chunks: ${totalChunks}`);
  console.log(`  ├─ Processed: ${processedChunks}`);
  console.log(`  ├─ Skipped (duplicates): ${skippedChunks}`);
  console.log(`  └─ Errors: ${errorChunks}`);
}

// Run ingestion
ingest().catch((error) => {
  console.error('\n❌ Ingestion failed:', error);
  process.exit(1);
});
