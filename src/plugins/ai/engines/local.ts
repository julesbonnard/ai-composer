import { buildPrompt, type Task } from '../prompts'
import type { TokenUsage } from '../activity'
import type { OnChunk } from '../engine'
import { reportFileProgress } from './loading'
import LocalWorker from './local.worker?worker'

// Moteur transformers.js (ONNX, WebGPU/WASM) : génération + embeddings 100% navigateur.
// La progression de téléchargement est relayée à l'UI via loading.ts (état partagé).

// Pont vers le Web Worker transformers.js. Corrélation requête/réponse par id afin
// de supporter plusieurs appels concurrents sur un worker unique (lazy).
let worker: Worker | null = null
let nextId = 0
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void; onChunk?: OnChunk }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new LocalWorker()
    worker.onmessage = (
      event: MessageEvent<
        | { type: 'progress'; model: string; data: any }
        | { id: number; chunk: string }
        | { id: number; result?: any; error?: string }
      >
    ) => {
      const message = event.data
      if ('type' in message) {
        reportFileProgress(message.model, message.data)
        return
      }
      // Incrément de streaming : on relaie le delta sans clore la requête.
      if ('chunk' in message) {
        pending.get(message.id)?.onChunk?.(message.chunk)
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

function call<T>(
  message: {
    kind: 'embed' | 'generate'
    model: string
    texts?: string[]
    prompt?: string
  },
  signal?: AbortSignal,
  onChunk?: OnChunk
): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    pending.set(id, { resolve, reject, onChunk })
    // Annulation : on demande au worker d'interrompre la génération (stopping
    // criteria) et on rejette tout de suite côté principal ; le résultat tardif
    // éventuel sera ignoré (id absent de `pending`).
    signal?.addEventListener(
      'abort',
      () => {
        const entry = pending.get(id)
        if (entry) {
          pending.delete(id)
          getWorker().postMessage({ id, kind: 'interrupt' })
          entry.reject(new DOMException('Aborted', 'AbortError'))
        }
      },
      { once: true }
    )
    getWorker().postMessage({ id, ...message })
  })
}

export function localComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string,
  signal?: AbortSignal,
  onChunk?: OnChunk
): Promise<{ text: string; usage?: TokenUsage }> {
  // transformers.js (text-generation) n'a pas de rôle système → on replie system+user.
  const { system, user } = buildPrompt(task, text, context)
  return call<{ text: string; usage?: TokenUsage }>(
    {
      kind: 'generate',
      model,
      prompt: `${system}\n\n${user}`
    },
    signal,
    onChunk
  )
}

export function localEmbed(
  texts: string[],
  model: string
): Promise<{ embeddings: number[][]; usage?: TokenUsage }> {
  return call<{ embeddings: number[][]; usage?: TokenUsage }>({ kind: 'embed', model, texts })
}
