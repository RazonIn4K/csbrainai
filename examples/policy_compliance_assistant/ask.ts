#!/usr/bin/env tsx
import { hydrateEnv } from '../shared/env';
import { policyExampleConfig } from './config';
import { generateEmbedding, generateAnswer } from '../../lib/openai';
import { searchDocuments } from '../../lib/supabase';

hydrateEnv();

interface AskOptions {
  query: string;
  matchCount: number;
  matchThreshold: number;
}

const DEFAULT_MATCH_COUNT = policyExampleConfig.matchCount ?? 6;
const DEFAULT_MATCH_THRESHOLD = policyExampleConfig.matchThreshold ?? 0.55;
const SAMPLE_QUESTIONS = policyExampleConfig.questions;

async function runQuery({ query, matchCount, matchThreshold }: AskOptions) {
  console.log(`\n🛡️  Policy Question: ${query}`);
  const embedding = await generateEmbedding(query);
  const docs = await searchDocuments(embedding, { matchCount, matchThreshold });

  if (docs.length === 0) {
    console.log('   → No policy snippets matched. Add more PDFs or lower the threshold.');
    return;
  }

  const context = docs.map((doc, idx) => `(${idx + 1}) ${doc.content}`);
  const { answer } = await generateAnswer(query, context);

  console.log('\n✅ Compliance Answer:\n');
  console.log(answer);
  console.log('\n📚 Citations:');
  docs.forEach((doc, idx) => {
    console.log(`   [${idx + 1}] ${doc.source_url} (score: ${doc.similarity.toFixed(3)})`);
  });
}

async function main() {
  const cliQuestion = process.argv.slice(2).join(' ').trim();
  const questions = cliQuestion ? [cliQuestion] : SAMPLE_QUESTIONS;

  for (const question of questions) {
    await runQuery({ query: question, matchCount: DEFAULT_MATCH_COUNT, matchThreshold: DEFAULT_MATCH_THRESHOLD });
  }
}

main().catch((error) => {
  console.error('Policy Q&A failed:', error);
  process.exit(1);
});
