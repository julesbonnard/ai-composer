import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm'
import { buildPrompt, type Task } from '../prompts'
import type { TokenUsage } from '../activity'
import type { OnChunk } from '../engine'
import { reportOverallProgress, clearProgress } from './loading'

// Moteur WebLLM (MLC) — inférence 100% navigateur via WebGPU. Génération ET embeddings
// (modèles MLC distincts). Appel direct à @mlc-ai/web-llm (pas de LangChain).
// ⚠️ WebGPU obligatoire (pas de repli WASM) ; premiers chargements lourds (plusieurs Go).
//
// Un moteur MLC charge UN modèle : on garde un cache (modelId → engine) afin de
// servir le modèle de génération et celui d'embeddings indépendamment.

const engines = new Map<string, Promise<MLCEngineInterface>>()

function getEngine(model: string): Promise<MLCEngineInterface> {
  if (!engines.has(model)) {
    engines.set(
      model,
      CreateMLCEngine(model, {
        initProgressCallback: (report) => {
          reportOverallProgress(model, (report.progress ?? 0) * 100, report.text ?? 'Loading…')
        }
      }).then((engine) => {
        clearProgress()
        return engine
      })
    )
  }
  return engines.get(model)!
}

export async function webllmComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string,
  signal?: AbortSignal,
  onChunk?: OnChunk
): Promise<{ text: string; usage?: TokenUsage }> {
  const engine = await getEngine(model)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Annulation (Échap) : MLC interrompt la génération en cours.
  const onAbort = () => engine.interruptGenerate()
  signal?.addEventListener('abort', onAbort, { once: true })
  const { system, user } = buildPrompt(task, text, context)
  try {
    // Flux SSE MLC : on relaie chaque delta ; include_usage → l'usage arrive dans
    // le dernier chunk (choices vide).
    const stream = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.5,
      stream: true,
      stream_options: { include_usage: true }
    })
    let full = ''
    let usage: TokenUsage | undefined
    for await (const chunk of stream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        full += delta
        onChunk?.(delta)
      }
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens
        }
      }
    }
    return { text: full, usage }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function webllmEmbed(
  texts: string[],
  model: string
): Promise<{ embeddings: number[][]; usage?: TokenUsage }> {
  const engine = await getEngine(model)
  const reply = await engine.embeddings.create({ input: texts })
  const embeddings = reply.data.map((d) => d.embedding as number[])
  return { embeddings, usage: { inputTokens: reply.usage?.prompt_tokens } }
}
