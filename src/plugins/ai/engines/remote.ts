import type { Task } from '../prompts'

// Moteur distant : délègue à la fonction serverless /api/llm, qui appelle le
// Vercel AI Gateway côté serveur (clé/OIDC jamais exposée au client). Le prompt
// est construit côté serveur à partir du module partagé prompts.ts.
const LLM_API = '/api/llm'

export async function remoteComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string | undefined
): Promise<string> {
  const response = await fetch(LLM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, text, context, model })
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error || `LLM request failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { text: string }
  return data.text
}

// Le Gateway ne fournit pas d'embeddings (cf. doc AI Gateway). Les embeddings sont
// donc toujours locaux — voir engines/local.ts.
export function remoteEmbed(): Promise<number[][]> {
  return Promise.reject(
    new Error("Le Vercel AI Gateway ne fait pas d'embeddings ; utilisez un modèle d'embeddings local.")
  )
}
