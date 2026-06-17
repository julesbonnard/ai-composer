import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm'
import { buildPrompt, type Task } from '../prompts'
import type { TokenUsage } from '../activity'
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
  signal?: AbortSignal
): Promise<{ text: string; usage?: TokenUsage }> {
  const engine = await getEngine(model)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Annulation (Échap) : MLC interrompt la génération en cours.
  const onAbort = () => engine.interruptGenerate()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const reply = await engine.chat.completions.create({
      messages: [{ role: 'user', content: buildPrompt(task, text, context) }],
      temperature: 0.5,
      stream: false
    })
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const output = reply.choices[0]?.message?.content ?? ''
    return {
      text: typeof output === 'string' ? output : '',
      usage: {
        inputTokens: reply.usage?.prompt_tokens,
        outputTokens: reply.usage?.completion_tokens
      }
    }
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
