#!/usr/bin/env node
/**
 * Nightly Evaluation Test Harness
 *
 * Runs 20 test questions from evals/questions.jsonl
 * POSTs to /api/answer and records results
 * Uploads artifact with pass/fail metrics
 *
 * Exit codes:
 *   0: All tests passed or minor regressions
 *   1: Severe regressions (>50% failure rate)
 */

const fs = require('fs');
const path = require('path');

const EVAL_FILE = path.join(__dirname, '../evals/questions.jsonl');
const RESULTS_FILE = path.join(__dirname, '../eval-results.json');
const API_URL = process.env.API_URL || 'http://localhost:3000/api/answer';

// Severity thresholds
const SEVERE_FAILURE_THRESHOLD = 0.5; // 50% failure rate

/**
 * Main evaluation runner
 */
async function main() {
  console.log('🧪 Starting nightly evaluation tests...\n');

  // 1. Load test questions
  let questions;
  try {
    const content = fs.readFileSync(EVAL_FILE, 'utf-8');
    questions = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    console.error('❌ Failed to load eval questions:', error.message);
    process.exit(1);
  }

  console.log(`📋 Loaded ${questions.length} test questions\n`);

  // 2. Run tests
  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`[${i + 1}/${questions.length}] Testing: ${question.query.slice(0, 60)}...`);

    const startTime = Date.now();
    let testResult;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: question.query }),
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      // Check for expected keywords (if provided)
      const passed = !question.expected_keywords ||
        question.expected_keywords.some((keyword) =>
          data.answer?.toLowerCase().includes(keyword.toLowerCase())
        );

      testResult = {
        id: question.id,
        query: question.query,
        answer: data.answer,
        citations_count: data.citations?.length || 0,
        latency_ms: latency,
        status: response.status,
        passed,
        error: response.ok ? null : data.message || 'Unknown error',
      };

      if (passed) {
        passCount++;
        console.log(`   ✅ Pass (${latency}ms)`);
      } else {
        failCount++;
        console.log(`   ❌ Fail - Expected keywords not found`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      testResult = {
        id: question.id,
        query: question.query,
        answer: null,
        citations_count: 0,
        latency_ms: latency,
        status: 0,
        passed: false,
        error: error.message,
      };
      failCount++;
      console.log(`   ❌ Fail - ${error.message}`);
    }

    results.push(testResult);

    // Rate limiting: wait 1 second between requests
    if (i < questions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // 3. Calculate metrics
  const totalTests = questions.length;
  const passRate = passCount / totalTests;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latency_ms, 0) / totalTests;

  const summary = {
    timestamp: new Date().toISOString(),
    total_tests: totalTests,
    passed: passCount,
    failed: failCount,
    pass_rate: passRate,
    avg_latency_ms: Math.round(avgLatency),
    results,
  };

  // 4. Write results to file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));

  // 5. Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Evaluation Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests:    ${totalTests}`);
  console.log(`Passed:         ${passCount} ✅`);
  console.log(`Failed:         ${failCount} ❌`);
  console.log(`Pass Rate:      ${(passRate * 100).toFixed(1)}%`);
  console.log(`Avg Latency:    ${Math.round(avgLatency)}ms`);
  console.log('='.repeat(50));

  // 6. Determine exit code
  if (passRate < 1 - SEVERE_FAILURE_THRESHOLD) {
    console.log('\n❌ SEVERE REGRESSION: >50% failure rate');
    console.log('This will fail the CI pipeline.');
    process.exit(1);
  } else if (failCount > 0) {
    console.log('\n⚠️  Minor regressions detected (soft-fail)');
    console.log('CI will continue, but please investigate.');
  } else {
    console.log('\n✅ All tests passed!');
  }

  process.exit(0);
}

// Run and handle errors
main().catch((error) => {
  console.error('\n❌ Eval runner crashed:', error);
  process.exit(1);
});
