import {
  pipeline,
  env,
  InterruptableStoppingCriteria,
  type PipelineType
} from '@huggingface/transformers'

// Modèles locaux exécutés 100% dans le navigateur (transformers.js). Les sources
// ne quittent jamais le poste. WebGPU si disponible, repli WASM.
env.allowLocalModels = false

const device: 'webgpu' | 'wasm' = 'gpu' in navigator ? 'webgpu' : 'wasm'

type Kind = 'embed' | 'generate' | 'interrupt'

interface WorkerRequest {
  id: number
  kind: Kind
  model?: string
  texts?: string[]
  prompt?: string
}

// Critères d'arrêt par requête, pour interrompre une génération (Échap côté UI).
const stoppers = new Map<number, InterruptableStoppingCriteria>()

// Cache des pipelines par (tâche, modèle).
const pipelines = new Map<string, Promise<any>>()

function getPipeline(task: PipelineType, model: string) {
  const key = `${task}:${model}`
  if (!pipelines.has(key)) {
    pipelines.set(
      key,
      pipeline(task, model, {
        device,
        dtype: device === 'webgpu' ? 'q4f16' : 'q8',
        // Progression de téléchargement/chargement → relayée à l'UI (broadcast,
        // sans id de requête).
        progress_callback: (data: unknown) => {
          self.postMessage({ type: 'progress', model, data })
        }
      })
    )
  }
  return pipelines.get(key)!
}

interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
}

async function embed(
  model: string,
  texts: string[]
): Promise<{ embeddings: number[][]; usage: TokenUsage }> {
  const extractor = await getPipeline('feature-extraction', model)
  const output = await extractor(texts, { pooling: 'mean', normalize: true })

  // Comptage exact des tokens d'entrée via le tokenizer du pipeline (somme sur les textes).
  let inputTokens: number | undefined
  try {
    inputTokens = texts.reduce((acc, t) => acc + extractor.tokenizer.encode(t).length, 0)
  } catch {
    inputTokens = undefined
  }
  return { embeddings: output.tolist(), usage: { inputTokens } }
}

async function generate(
  id: number,
  model: string,
  prompt: string
): Promise<{ text: string; usage: TokenUsage }> {
  const generator = await getPipeline('text-generation', model)
  const stopper = new InterruptableStoppingCriteria()
  stoppers.set(id, stopper)
  let output: any
  try {
    output = await generator([{ role: 'user', content: prompt }], {
      max_new_tokens: 256,
      do_sample: false,
      stopping_criteria: stopper
    })
  } finally {
    stoppers.delete(id)
  }
  const generated = output[0]?.generated_text
  let text: string
  // Modèle de chat : generated_text est la liste de messages → on prend la réponse.
  if (Array.isArray(generated)) {
    text = generated.at(-1)?.content ?? ''
  } else {
    // Modèle texte brut : on retire le prompt en tête.
    text = typeof generated === 'string' ? generated.slice(prompt.length).trim() : ''
  }

  // Comptage exact via le tokenizer déjà chargé dans le pipeline (encode → ids).
  const count = (input: string): number | undefined => {
    try {
      return generator.tokenizer.encode(input).length
    } catch {
      return undefined
    }
  }
  return { text, usage: { inputTokens: count(prompt), outputTokens: count(text) } }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, kind, model, texts, prompt } = event.data

  // Interruption d'une génération en cours : on déclenche le stopping criteria.
  if (kind === 'interrupt') {
    stoppers.get(id)?.interrupt()
    return
  }

  try {
    const result =
      kind === 'embed'
        ? await embed(model ?? '', texts ?? [])
        : await generate(id, model ?? '', prompt ?? '')
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
