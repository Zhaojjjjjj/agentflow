// Rough per-1M-token USD pricing for cost estimates.
// Unknown models fall back to DEFAULT_RATE.

interface Rate {
  input: number;
  output: number;
}

const RATES: Record<string, Rate> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "qwen-plus": { input: 0.8, output: 2.4 },
  "qwen-turbo": { input: 0.3, output: 0.6 },
  "doubao-seed-1-6": { input: 0.8, output: 2.4 },
  "glm-4": { input: 1, output: 1 },
  "moonshot-v1-8k": { input: 1.6, output: 1.6 },
};

const DEFAULT_RATE: Rate = { input: 1, output: 3 };

function rateFor(model: string): Rate {
  const m = model.toLowerCase();
  for (const [key, rate] of Object.entries(RATES)) {
    if (m.includes(key)) return rate;
  }
  return DEFAULT_RATE;
}

/** Estimated USD cost for a completion. */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const r = rateFor(model);
  return (promptTokens / 1_000_000) * r.input + (completionTokens / 1_000_000) * r.output;
}
