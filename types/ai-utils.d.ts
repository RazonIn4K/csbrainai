declare module 'ai-utils' {
  export function estimate_llm_cost(
    params: Record<string, unknown>
  ): number | { cost?: number; usd?: number } | Promise<number | { cost?: number; usd?: number }>;
  const _default: {
    estimate_llm_cost?: typeof estimate_llm_cost;
  };
  export default _default;
}
