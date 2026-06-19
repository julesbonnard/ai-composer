// Tarifs INDICATIFS ($ par million de tokens) pour estimer le coût cumulé des appels
// Gateway. Les moteurs locaux (transformers/WebLLM/MediaPipe) sont gratuits → absents.
// ⚠️ Les prix évoluent : à vérifier dans le dashboard Vercel AI Gateway. `input` = prompt,
// `output` = génération ; pour les embeddings, seul `input` s'applique.
interface Price {
  input: number
  output?: number
}

const PRICES: Record<string, Price> = {
  // — LLM —
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10 },
  'google/gemini-3-flash': { input: 0.3, output: 2.5 },
  'openai/gpt-5-nano': { input: 0.05, output: 0.4 },
  'openai/gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'openai/gpt-5': { input: 1.25, output: 10 },
  'openai/gpt-4.1': { input: 2, output: 8 },
  'mistral/ministral-3b': { input: 0.1, output: 0.1 },
  'mistral/mistral-small': { input: 0.1, output: 0.3 },
  'mistral/mistral-large-3': { input: 2, output: 6 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 }, // défaut
  'anthropic/claude-opus-4.8': { input: 15, output: 75 },
  // — Embeddings (input seul) —
  'openai/text-embedding-3-small': { input: 0.02 },
  'openai/text-embedding-3-large': { input: 0.13 },
  'google/gemini-embedding-001': { input: 0.15 },
  'mistral/mistral-embed': { input: 0.1 }
}

// Coût ($) d'un appel pour un modèle et un usage donnés. 0 si le modèle est inconnu
// (moteur local ou tarif non répertorié → l'estimation reste une borne basse).
export function costOf(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number }
): number {
  const p = PRICES[model]
  if (!p) return 0
  const inCost = ((usage.inputTokens ?? 0) / 1_000_000) * p.input
  const outCost = ((usage.outputTokens ?? 0) / 1_000_000) * (p.output ?? 0)
  return inCost + outCost
}

export function hasPrice(model: string): boolean {
  return model in PRICES
}
