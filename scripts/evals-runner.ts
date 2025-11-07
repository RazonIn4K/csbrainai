#!/usr/bin/env tsx

/**
 * RAG Evaluation Runner
 *
 * This script:
 * 1. Loads test questions from data/evals/test-questions.jsonl
 * 2. Sends each question to the /api/answer endpoint
 * 3. Evaluates responses based on multiple criteria
 * 4. Generates evaluation report and artifacts
 *
 * Usage: npm run evals
 */

import * as fs from 'fs';
import * as path from 'path';

// Support testing both local and production environments
const API_URL = process.env.API_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';
const EVALS_FILE = path.join(process.cwd(), 'data', 'evals', 'test-questions.jsonl');
const RESULTS_FILE = path.join(process.cwd(), 'eval-results.json');
const SUMMARY_FILE = path.join(process.cwd(), 'eval-summary.txt');

interface TestQuestion {
  id: string;
  question: string;
  expected_keywords?: string[];
  category?: string;
}

interface EvalResult {
  id: string;
  question: string;
  answer: string;
  q_hash: string;
  q_len: number;
  citations_count: number;
  response_time_ms: number;
  tokens_used?: number;
  has_expected_keywords: boolean;
  quality_score: number;
  error?: string;
}

interface EvalSummary {
  total_questions: number;
  successful: number;
  failed: number;
  avg_response_time_ms: number;
  avg_quality_score: number;
  overall_quality: number;
  results: EvalResult[];
  timestamp: string;
}

/**
 * Load test questions from JSONL file
 */
function loadTestQuestions(): TestQuestion[] {
  if (!fs.existsSync(EVALS_FILE)) {
    throw new Error(`Evals file not found: ${EVALS_FILE}`);
  }

  const content = fs.readFileSync(EVALS_FILE, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  return lines.map((line) => JSON.parse(line));
}

/**
 * Call the /api/answer endpoint
 */
async function askQuestion(question: string): Promise<any> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: question }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      ...data,
      response_time_ms: responseTime,
    };
  } catch (error: any) {
    return {
      error: error.message,
      response_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Evaluate response quality
 */
function evaluateResponse(
  response: any,
  testQuestion: TestQuestion
): { quality_score: number; has_expected_keywords: boolean } {
  let qualityScore = 0;
  let hasExpectedKeywords = false;

  if (response.error) {
    return { quality_score: 0, has_expected_keywords: false };
  }

  const answer = (response.answer || '').toLowerCase();

  // Check for expected keywords (if provided)
  if (testQuestion.expected_keywords && testQuestion.expected_keywords.length > 0) {
    const matchedKeywords = testQuestion.expected_keywords.filter((keyword) =>
      answer.includes(keyword.toLowerCase())
    );
    hasExpectedKeywords = matchedKeywords.length > 0;
    qualityScore += (matchedKeywords.length / testQuestion.expected_keywords.length) * 0.4;
  } else {
    // If no keywords, assume pass
    hasExpectedKeywords = true;
    qualityScore += 0.4;
  }

  // Has citations
  if (response.citations && response.citations.length > 0) {
    qualityScore += 0.3;
  }

  // Answer is not empty or a default "I don't know" response
  if (answer && !answer.includes("don't have enough information")) {
    qualityScore += 0.2;
  }

  // Reasonable response time (< 5 seconds)
  if (response.response_time_ms < 5000) {
    qualityScore += 0.1;
  }

  return { quality_score: Math.min(qualityScore, 1.0), has_expected_keywords };
}

/**
 * Run evaluations
 */
async function runEvaluations() {
  console.log('🧪 Starting RAG evaluations...\n');

  // Load test questions
  const testQuestions = loadTestQuestions();
  console.log(`📋 Loaded ${testQuestions.length} test questions\n`);

  const results: EvalResult[] = [];

  // Process each question
  for (let i = 0; i < testQuestions.length; i++) {
    const testQ = testQuestions[i];
    console.log(`[${i + 1}/${testQuestions.length}] ${testQ.question}`);

    const response = await askQuestion(testQ.question);
    const evaluation = evaluateResponse(response, testQ);

    const result: EvalResult = {
      id: testQ.id,
      question: testQ.question,
      answer: response.answer || '',
      q_hash: response.q_hash || '',
      q_len: response.q_len || testQ.question.length,
      citations_count: response.citations?.length || 0,
      response_time_ms: response.response_time_ms,
      tokens_used: response.tokensUsed,
      has_expected_keywords: evaluation.has_expected_keywords,
      quality_score: evaluation.quality_score,
      error: response.error,
    };

    results.push(result);

    console.log(`  ├─ Quality: ${(result.quality_score * 100).toFixed(0)}%`);
    console.log(`  ├─ Response time: ${result.response_time_ms}ms`);
    console.log(`  └─ Citations: ${result.citations_count}\n`);

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Calculate summary statistics
  const successful = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  const avgResponseTime =
    results.reduce((sum, r) => sum + r.response_time_ms, 0) / results.length;
  const avgQualityScore =
    results.reduce((sum, r) => sum + r.quality_score, 0) / results.length;

  const summary: EvalSummary = {
    total_questions: testQuestions.length,
    successful,
    failed,
    avg_response_time_ms: Math.round(avgResponseTime),
    avg_quality_score: Math.round(avgQualityScore * 100) / 100,
    overall_quality: avgQualityScore,
    results,
    timestamp: new Date().toISOString(),
  };

  // Write results to JSON file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`\n✅ Results written to: ${RESULTS_FILE}`);

  // Write summary to text file
  const summaryText = `
RAG Evaluation Summary
======================
Timestamp: ${summary.timestamp}

Results:
  Total Questions: ${summary.total_questions}
  Successful: ${summary.successful}
  Failed: ${summary.failed}

Performance:
  Avg Response Time: ${summary.avg_response_time_ms}ms
  Avg Quality Score: ${(summary.avg_quality_score * 100).toFixed(1)}%
  Overall Quality: ${(summary.overall_quality * 100).toFixed(1)}%

${summary.overall_quality < 0.5 ? '❌ SEVERE REGRESSION DETECTED' : '✅ Quality check passed'}
  `.trim();

  fs.writeFileSync(SUMMARY_FILE, summaryText);
  console.log(`✅ Summary written to: ${SUMMARY_FILE}`);

  if (summary.overall_quality < 0.5) {
    console.error('\n❌ Quality threshold not met (requires >= 50%).');
    console.error('Artifacts saved at:');
    console.error(`  - ${RESULTS_FILE}`);
    console.error(`  - ${SUMMARY_FILE}`);
    process.exit(1);
  }

  console.log('\n✅ Quality threshold met (>= 50%).');

  // Print summary
  console.log('\n' + summaryText);

  // Exit with error code if quality is too low
  if (summary.overall_quality < 0.5) {
    console.error('\n❌ Severe quality regression detected!');
    process.exit(1);
  }
}

// Run evaluations
runEvaluations().catch((error) => {
  console.error('\n❌ Evaluation failed:', error);
  process.exit(1);
});
