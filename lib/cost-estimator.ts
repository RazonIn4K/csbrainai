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

type CostEstimator = (input: Record<string, unknown>) => unknown | Promise<unknown>;

let estimatorPromise: Promise<CostEstimator | null> | null = null;

type OptionalEstimatorModule = {
  estimate_llm_cost?: unknown;
  default?: {
    estimate_llm_cost?: unknown;
  };
  ai_utils?: {
    estimate_llm_cost?: unknown;
  };
};

async function loadEstimator() {
  if (!estimatorPromise) {
    const runtimeImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<OptionalEstimatorModule>;

    estimatorPromise = runtimeImport('ai-utils')
      .then((mod) => {
        const fn =
          mod?.estimate_llm_cost ||
          mod?.default?.estimate_llm_cost ||
          mod?.ai_utils?.estimate_llm_cost;
        return typeof fn === 'function' ? (fn as CostEstimator) : null;
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
