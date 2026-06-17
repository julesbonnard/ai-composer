import { pipeline, env, type PipelineType } from '@huggingface/transformers'

// Modèles locaux exécutés 100% dans le navigateur (transformers.js). Les sources
// ne quittent jamais le poste. WebGPU si disponible, repli WASM.
env.allowLocalModels = false

const device: 'webgpu' | 'wasm' = 'gpu' in navigator ? 'webgpu' : 'wasm'

type Kind = 'embed' | 'generate'

interface WorkerRequest {
  id: number
  kind: Kind
  model: string
  texts?: string[]
  prompt?: string
}

// Cache des pipelines par (tâche, modèle).
const pipelines = new Map<string, Promise<any>>()

function getPipeline(task: PipelineType, model: string) {
  const key = `${task}:${model}`
  if (!pipelines.has(key)) {
    pipelines.set(
      key,
      pipeline(task, model, {
        device,
        dtype: device === 'webgpu' ? 'q4f16' : 'q8'
      })
    )
  }
  return pipelines.get(key)!
}

async function embed(model: string, texts: string[]): Promise<number[][]> {
  const extractor = await getPipeline('feature-extraction', model)
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  return output.tolist()
}

async function generate(model: string, prompt: string): Promise<string> {
  const generator = await getPipeline('text-generation', model)
  const output = await generator([{ role: 'user', content: prompt }], {
    max_new_tokens: 256,
    do_sample: false
  })
  const generated = output[0]?.generated_text
  // Modèle de chat : generated_text est la liste de messages → on prend la réponse.
  if (Array.isArray(generated)) {
    return generated.at(-1)?.content ?? ''
  }
  // Modèle texte brut : on retire le prompt en tête.
  return typeof generated === 'string' ? generated.slice(prompt.length).trim() : ''
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, kind, model, texts, prompt } = event.data
  try {
    const result =
      kind === 'embed'
        ? await embed(model, texts ?? [])
        : await generate(model, prompt ?? '')
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
