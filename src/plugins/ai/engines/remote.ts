import type { Task } from '../prompts'
import type { TokenUsage } from '../activity'

// Moteur distant : délègue à la fonction serverless /api/llm, qui appelle le
// Vercel AI Gateway côté serveur (clé/OIDC jamais exposée au client). Le prompt
// est construit côté serveur à partir du module partagé prompts.ts.
const LLM_API = '/api/llm'

export async function remoteComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string | undefined,
  signal?: AbortSignal
): Promise<{ text: string; usage?: TokenUsage }> {
  const response = await fetch(LLM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, text, context, model }),
    signal
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error || `LLM request failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { text: string; usage?: TokenUsage }
  return { text: data.text, usage: data.usage }
}

// Embeddings distants via la fonction serverless /api/embed (Gateway/OIDC côté
// serveur). Le Gateway route bien les modèles d'embeddings (cf. api/embed.ts).
const EMBED_API = '/api/embed'

export async function remoteEmbed(
  texts: string[],
  model: string | undefined
): Promise<{ embeddings: number[][]; usage?: TokenUsage }> {
  const response = await fetch(EMBED_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, model })
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error || `Embed request failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { embeddings: number[][]; usage?: { tokens?: number } }
  return { embeddings: data.embeddings, usage: { inputTokens: data.usage?.tokens } }
}
