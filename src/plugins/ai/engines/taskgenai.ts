import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai'
import { buildPrompt, type Task } from '../prompts'
import type { TokenUsage } from '../activity'
import { reportOverallProgress, clearProgress } from './loading'

// Moteur MediaPipe Tasks GenAI — inférence navigateur de modèles Gemma au format
// `.task` (WebGPU/WASM). Génération uniquement (pas d'embeddings côté MediaPipe).
//
// ⚠️ Les fichiers `.task` doivent être hébergés et servis avec CORS. Le nom de modèle
// de config/models.ts est résolu en URL via VITE_TASKGENAI_BASE_URL (ou peut être une
// URL complète). Non validé en runtime (téléchargement + WebGPU à éprouver).

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm'
const BASE_URL = (import.meta.env.VITE_TASKGENAI_BASE_URL as string | undefined)?.replace(/\/$/, '')

const instances = new Map<string, Promise<LlmInference>>()

function resolveModelUrl(model: string): string {
  if (/^https?:\/\//.test(model)) return model
  if (!BASE_URL) {
    throw new Error(
      `Modèle MediaPipe « ${model} » sans URL : définissez VITE_TASKGENAI_BASE_URL ou fournissez une URL .task complète.`
    )
  }
  return `${BASE_URL}/${model}`
}

function getInstance(model: string): Promise<LlmInference> {
  if (!instances.has(model)) {
    instances.set(
      model,
      (async () => {
        reportOverallProgress(model, 5, 'Loading MediaPipe…')
        const fileset = await FilesetResolver.forGenAiTasks(WASM_PATH)
        const llm = await LlmInference.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: resolveModelUrl(model) },
          maxTokens: 2048,
          topK: 1,
          temperature: 0.1,
          randomSeed: 1
        })
        clearProgress()
        return llm
      })()
    )
  }
  return instances.get(model)!
}

// Gemma attend un gabarit de tour de parole explicite.
function toGemmaPrompt(prompt: string): string {
  return `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`
}

export async function taskgenaiComplete(
  task: Task,
  text: string,
  context: string | undefined,
  model: string,
  signal?: AbortSignal
): Promise<{ text: string; usage?: TokenUsage }> {
  const llm = await getInstance(model)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const prompt = toGemmaPrompt(buildPrompt(task, text, context))
  const output = await llm.generateResponse(prompt)
  // MediaPipe n'expose pas d'interruption en cours de génération : best-effort,
  // on jette le résultat si l'utilisateur a annulé entre-temps.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let usage: TokenUsage | undefined
  try {
    usage = { inputTokens: llm.sizeInTokens(prompt), outputTokens: llm.sizeInTokens(output) }
  } catch {
    usage = undefined
  }
  return { text: output, usage }
}
