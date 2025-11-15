#!/usr/bin/env tsx
import { hydrateEnv } from '../shared/env';
import { generateEmbedding, generateAnswer } from '../../lib/openai';
import { searchDocuments } from '../../lib/supabase';

hydrateEnv();

interface AskOptions {
  query: string;
  matchCount: number;
  matchThreshold: number;
}

const SAMPLE_QUESTIONS = [
  'Summarize revenue guidance vs. last quarter.',
  'Highlight the top 3 risk factors the CFO flagged.',
  'What capital allocation commitments were made?',
];

async function runQuery({ query, matchCount, matchThreshold }: AskOptions) {
  console.log(`\n🔎 Question: ${query}`);
  const embedding = await generateEmbedding(query);
  const docs = await searchDocuments(embedding, { matchCount, matchThreshold });

  if (docs.length === 0) {
    console.log('   → No finance snippets matched. Try ingesting more PDFs.');
    return;
  }

  const context = docs.map((doc, idx) => `(${idx + 1}) ${doc.content}`);
  const { answer } = await generateAnswer(query, context);

  console.log('💡 Answer:\n');
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
    await runQuery({ query: question, matchCount: 5, matchThreshold: 0.5 });
  }
}

main().catch((error) => {
  console.error('Sample finance Q&A failed:', error);
  process.exit(1);
});
