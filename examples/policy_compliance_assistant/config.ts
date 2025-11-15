export const policyExampleConfig = {
  pdfDirectory: 'examples/policy_compliance_assistant/policies',
  chunkSize: 1200,
  chunkOverlap: 150,
  minChunkLength: 180,
  questions: [
    'Summarize the key data retention requirements we must enforce.',
    'What access controls must auditors review quarterly?',
    'List the escalation steps if a privacy breach is detected.',
  ],
  matchCount: 6,
  matchThreshold: 0.55,
};
