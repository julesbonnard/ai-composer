import { buildPrompt, type Task } from '../prompts'
import type { TokenUsage } from '../activity'
import { reportFileProgress } from './loading'
import LocalWorker from './local.worker?worker'

// Moteur transformers.js (ONNX, WebGPU/WASM) : génération + embeddings 100% navigateur.
// La progression de téléchargement est relayée à l'UI via loading.ts (état partagé).

// Pont vers le Web Worker transformers.js. Corrélation requête/réponse par id afin
// de supporter plusieurs appels concurrents sur un worker unique (lazy).
let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new LocalWorker()
    worker.onmessage = (
      event: MessageEvent<
        { type: 'progress'; model: string; data: any } | { id: number; result?: any; error?: string }
      >
    ) => {
      const message = event.data
      if ('type' in message) {
        reportFileProgress(message.model, message.data)
        return
      }
      const { id, result, error } = message
      const entry = pending.get(id)
      if (!entry) return
      pending.delete(id)
      if (error) entry.reject(new Error(error))
      else entry.resolve(result)
    }
  }
  return worker
}

function call<T>(message: {
  kind: 'embed' | 'generate'
  model: string
  texts?: string[]
  prompt?: string
}): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, ...message })
  })
}

export function localComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string
): Promise<{ text: string; usage?: TokenUsage }> {
  return call<{ text: string; usage?: TokenUsage }>({
    kind: 'generate',
    model,
    prompt: buildPrompt(task, text, context)
  })
}

export function localEmbed(
  texts: string[],
  model: string
): Promise<{ embeddings: number[][]; usage?: TokenUsage }> {
  return call<{ embeddings: number[][]; usage?: TokenUsage }>({ kind: 'embed', model, texts })
}
