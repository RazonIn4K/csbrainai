interface LlmUsageInput {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface CostEstimateResult {
  success: boolean;
  costUsd: number | null;
  provider: 'ai-utils' | 'none';
  error?: string;
}

let estimatorPromise: Promise<((input: Record<string, unknown>) => any) | null> | null = null;

async function loadEstimator() {
  if (!estimatorPromise) {
    estimatorPromise = import('ai-utils')
      .then((mod) => {
        const fn =
          (mod as any)?.estimate_llm_cost ||
          (mod as any)?.default?.estimate_llm_cost ||
          (mod as any)?.ai_utils?.estimate_llm_cost;
        return typeof fn === 'function' ? fn : null;
      })
      .catch(() => null);
  }
  return estimatorPromise;
}

function coerceNumber(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export async function estimateLlmCost(usage: LlmUsageInput): Promise<CostEstimateResult> {
  const estimator = await loadEstimator();
  if (!estimator) {
    return { success: false, costUsd: null, provider: 'none' };
  }

  try {
    const payload: Record<string, unknown> = {
      model: usage.model,
    };

    if (usage.promptTokens !== undefined) {
      payload.prompt_tokens = usage.promptTokens;
    }
    if (usage.completionTokens !== undefined) {
      payload.completion_tokens = usage.completionTokens;
    }
    if (usage.totalTokens !== undefined) {
      payload.total_tokens = usage.totalTokens;
    }

    const raw = await estimator(payload);
    let cost = coerceNumber(raw);

    if (cost === null && raw && typeof raw === 'object') {
      cost = coerceNumber((raw as any).cost) ?? coerceNumber((raw as any).usd);
    }

    return {
      success: cost !== null,
      costUsd: cost,
      provider: 'ai-utils',
      error: cost === null ? 'Estimator returned unsupported payload' : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      costUsd: null,
      provider: 'ai-utils',
      error: error?.message,
    };
  }
}
