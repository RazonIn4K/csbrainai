import * as Sentry from '@sentry/nextjs';

export interface PromptGuardVerdict {
  flagged: boolean;
  triggers: string[];
}

const PROMPT_GUARD_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'override_instructions', regex: /ignore (all )?(previous|prior) instructions/i },
  { label: 'system_prompt_access', regex: /reveal (your )?(system|hidden) prompt/i },
  { label: 'data_exfil', regex: /exfiltrate|steal|leak data/i },
  { label: 'prompt_injection_marker', regex: /BEGIN PROMPT INJECTION/i },
  { label: 'malicious_code', regex: /<script|\beval\(|rm -rf/i },
];

export function evaluatePromptForInjection(query: string): PromptGuardVerdict {
  const triggers = PROMPT_GUARD_PATTERNS.filter((pattern) => pattern.regex.test(query)).map(
    (pattern) => pattern.label
  );

  const verdict: PromptGuardVerdict = {
    flagged: triggers.length > 0,
    triggers,
  };

  if (verdict.flagged) {
    Sentry.addBreadcrumb({
      category: 'rag.prompt_guard',
      message: 'Suspicious prompt detected',
      level: 'warning',
      data: {
        triggers,
      },
    });
  }

  return verdict;
}

export function shouldBlockPrompt(verdict: PromptGuardVerdict): boolean {
  if (!verdict.flagged) {
    return false;
  }

  const mode = (process.env.PROMPT_GUARD_MODE || 'log').toLowerCase();
  return mode === 'block';
}
