import type { Task } from '../prompts'
import type { TokenUsage } from '../activity'
import type { OnChunk } from '../engine'

// Moteur distant : délègue à la fonction serverless /api/llm, qui appelle le
// Vercel AI Gateway côté serveur (clé/OIDC jamais exposée au client). Le prompt
// est construit côté serveur à partir du module partagé prompts.ts. La réponse est
// un flux NDJSON ({"delta"}… puis {"usage"} ; {"error"} en cas d'échec en cours de flux).
const LLM_API = '/api/llm'

export async function remoteComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string | undefined,
  signal?: AbortSignal,
  onChunk?: OnChunk
): Promise<{ text: string; usage?: TokenUsage }> {
  const response = await fetch(LLM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, text, context, model }),
    signal
  })

  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error || `LLM request failed: ${response.statusText}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let full = ''
  let usage: TokenUsage | undefined

  // Traite chaque ligne NDJSON complète présente dans le buffer.
  const drain = (flush = false) => {
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) handleLine(line)
    }
    if (flush && buffer.trim()) {
      handleLine(buffer.trim())
      buffer = ''
    }
  }
  const handleLine = (line: string) => {
    const msg = JSON.parse(line) as { delta?: string; usage?: TokenUsage; error?: string }
    if (msg.error) throw new Error(msg.error)
    if (msg.delta) {
      full += msg.delta
      onChunk?.(msg.delta)
    }
    if (msg.usage) usage = msg.usage
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    drain()
  }
  drain(true)

  return { text: full, usage }
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
