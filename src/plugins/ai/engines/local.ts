import { buildPrompt, type Task } from '../prompts'
import LocalWorker from './local.worker?worker'

// Pont vers le Web Worker transformers.js. Corrélation requête/réponse par id afin
// de supporter plusieurs appels concurrents sur un worker unique (lazy).
let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new LocalWorker()
    worker.onmessage = (event: MessageEvent<{ id: number; result?: any; error?: string }>) => {
      const { id, result, error } = event.data
      const entry = pending.get(id)
      if (!entry) return
      pending.delete(id)
      if (error) entry.reject(new Error(error))
      else entry.resolve(result)
    }
  }
  return worker
}

function call<T>(message: { kind: 'embed' | 'generate'; model: string; texts?: string[]; prompt?: string }): Promise<T> {
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
): Promise<string> {
  return call<string>({ kind: 'generate', model, prompt: buildPrompt(task, text, context) })
}

export function localEmbed(texts: string[], model: string): Promise<number[][]> {
  return call<number[][]>({ kind: 'embed', model, texts })
}
