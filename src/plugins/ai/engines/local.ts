import { reactive } from 'vue'
import { buildPrompt, type Task } from '../prompts'
import LocalWorker from './local.worker?worker'

// État réactif du chargement des modèles locaux, consommé par l'UI
// (LocalModelLoader.vue). Le worker diffuse la progression de téléchargement.
export interface FileProgress {
  name: string
  progress: number // 0..100
  status: string
}

export const localModelState = reactive({
  loading: false,
  modelId: '',
  files: {} as Record<string, FileProgress>
})

function recomputeLoading() {
  const files = Object.values(localModelState.files)
  localModelState.loading = files.length > 0 && files.some((f) => f.progress < 100)
  // Une fois tout téléchargé, on laisse l'UI afficher 100% puis on nettoie.
  if (!localModelState.loading && files.length > 0) {
    setTimeout(() => {
      localModelState.files = {}
    }, 1200)
  }
}

function handleProgress(model: string, data: any) {
  localModelState.modelId = model
  if (data?.status === 'ready') {
    localModelState.files = {}
    localModelState.loading = false
    return
  }
  if (!data?.file) return
  localModelState.files[data.file] = {
    name: data.file,
    progress: data.status === 'done' ? 100 : Math.round(data.progress ?? 0),
    status: data.status
  }
  recomputeLoading()
}

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
        handleProgress(message.model, message.data)
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
): Promise<string> {
  return call<string>({ kind: 'generate', model, prompt: buildPrompt(task, text, context) })
}

export function localEmbed(texts: string[], model: string): Promise<number[][]> {
  return call<number[][]>({ kind: 'embed', model, texts })
}
