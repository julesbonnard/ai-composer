import modelsConfig from '../../config/models'
import { llmSelection, embeddingsSelection } from './selection'
import type { Task } from './prompts'
import { remoteComplete, remoteEmbed } from './engines/remote'
import { localComplete, localEmbed } from './engines/local'
import { webllmComplete, webllmEmbed } from './engines/webllm'
import { taskgenaiComplete } from './engines/taskgenai'
import { startActivity, endActivity, type TokenUsage } from './activity'
import { toastError } from '../../composables/useToasts'

type CompleteResult = { text: string; usage?: TokenUsage }
type EmbedResult = { embeddings: number[][]; usage?: TokenUsage }

// Traduit une erreur moteur (souvent technique) en message lisible pour le toast.
function reportAiError(error: unknown, mode: 'local' | 'cloud', model: string) {
  const raw = error instanceof Error ? error.message : String(error)
  const engine = mode === 'local' ? 'modèle local' : 'Gateway'

  if (/rate.?limit|\b429\b/i.test(raw)) {
    toastError('Trop de requêtes, réessayez dans un instant.', 'Limite atteinte')
  } else if (/budget|\b402\b/i.test(raw)) {
    toastError('Le budget IA est épuisé pour le moment.', 'Budget épuisé')
  } else if (/unauthorized|\b401\b|access to model/i.test(raw)) {
    toastError(
      mode === 'local'
        ? `Modèle « ${model} » introuvable ou à accès restreint sur Hugging Face.`
        : `Accès refusé au modèle « ${model} ».`,
      'Modèle inaccessible'
    )
  } else if (/webgpu/i.test(raw)) {
    toastError('WebGPU indisponible dans ce navigateur (requis pour ce modèle local).', 'WebGPU requis')
  } else if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    toastError('Impossible de joindre le service. Vérifiez votre connexion.', 'Réseau')
  } else {
    toastError(raw || `Échec de l'opération (${engine}).`, 'Erreur IA')
  }
}

// Le flag `local` (config/models.ts) pilote l'affichage cloud/local du badge ; le
// nom du provider pilote le choix du moteur (dispatch ci-dessous).
function isLocal(provider: string): boolean {
  return Boolean((modelsConfig as Record<string, { local?: boolean }>)[provider]?.local)
}

// Annulation : Échap (cf. Autocompletion.ts) appelle abortGeneration(), qui coupe
// toutes les générations en cours — réseau (fetch) comme calcul navigateur (worker
// transformers, interruptGenerate MLC). Les embeddings ne sont pas annulés (rapides
// et parfois liés à une vectorisation de source en arrière-plan).
const activeControllers = new Set<AbortController>()

export function abortGeneration() {
  for (const controller of activeControllers) controller.abort()
  activeControllers.clear()
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

// Dispatch génération par provider. Chaque moteur renvoie { text, usage }.
function dispatchComplete(
  provider: string,
  task: Task,
  text: string,
  context: string | undefined,
  model: string,
  signal: AbortSignal
): Promise<CompleteResult> {
  switch (provider) {
    case 'gateway':
      return remoteComplete(task, text, context, model, signal)
    case 'transformers':
      return localComplete(task, text, context, model, signal)
    case 'webLLM':
      return webllmComplete(task, text, context, model, signal)
    case 'taskgenai':
      return taskgenaiComplete(task, text, context, model, signal)
    default:
      return Promise.reject(new Error(`Provider de génération non câblé : ${provider}`))
  }
}

// Dispatch embeddings par provider. MediaPipe n'en fournit pas.
function dispatchEmbed(provider: string, texts: string[], model: string): Promise<EmbedResult> {
  switch (provider) {
    case 'gateway':
      return remoteEmbed(texts, model)
    case 'transformers':
      return localEmbed(texts, model)
    case 'webLLM':
      return webllmEmbed(texts, model)
    case 'taskgenai':
      return Promise.reject(
        new Error('MediaPipe ne fournit pas d’embeddings ; choisissez un autre provider.')
      )
    default:
      return Promise.reject(new Error(`Provider d’embeddings non câblé : ${provider}`))
  }
}

export async function complete(task: Task, text: string, context?: string): Promise<string> {
  const provider = llmSelection.provider
  const local = isLocal(provider)
  const controller = new AbortController()
  activeControllers.add(controller)
  startActivity(local ? 'local' : 'cloud', llmSelection.model, task)
  try {
    const { text: output, usage } = await dispatchComplete(
      provider,
      task,
      text,
      context,
      llmSelection.model,
      controller.signal
    )
    endActivity(usage)
    return output
  } catch (error) {
    endActivity()
    // Annulation volontaire (Échap) : ni toast ni bruit, on relaie juste le rejet.
    if (!controller.signal.aborted && !isAbort(error)) {
      reportAiError(error, local ? 'local' : 'cloud', llmSelection.model)
    }
    throw error
  } finally {
    activeControllers.delete(controller)
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const provider = embeddingsSelection.provider
  const local = isLocal(provider)
  const model = embeddingsSelection.model
  startActivity(local ? 'local' : 'cloud', model, 'embed')
  try {
    const { embeddings, usage } = await dispatchEmbed(provider, texts, model)
    endActivity(usage)
    return embeddings
  } catch (error) {
    endActivity()
    reportAiError(error, local ? 'local' : 'cloud', model)
    throw error
  }
}
