import modelsConfig from '../../config/models'
import { getLlmSelection, embeddingsSelection } from './selection'
import { buildPrompt, type Task } from './prompts'
import { isAiDebug, logCompletion } from './debug'
import { remoteComplete, remoteEmbed } from './engines/remote'
import { localComplete, localEmbed } from './engines/local'
import { webllmComplete, webllmEmbed } from './engines/webllm'
import { taskgenaiComplete } from './engines/taskgenai'
import { startActivity, endActivity, addCost, type TokenUsage } from './activity'
import { costOf } from './pricing'
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

// Callback de streaming : reçoit chaque incrément de texte (delta) au fil de la
// génération. Optionnel — un moteur qui ne sait pas streamer renvoie tout à la fin.
export type OnChunk = (delta: string) => void

// Dispatch génération par provider. Chaque moteur renvoie { text, usage } et,
// si onChunk est fourni, émet les deltas au fil de l'eau.
function dispatchComplete(
  provider: string,
  task: Task,
  text: string,
  context: string | undefined,
  model: string,
  signal: AbortSignal,
  onChunk?: OnChunk
): Promise<CompleteResult> {
  switch (provider) {
    case 'gateway':
      return remoteComplete(task, text, context, model, signal, onChunk)
    case 'transformers':
      return localComplete(task, text, context, model, signal, onChunk)
    case 'webLLM':
      return webllmComplete(task, text, context, model, signal, onChunk)
    case 'taskgenai':
      return taskgenaiComplete(task, text, context, model, signal, onChunk)
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

export async function complete(
  task: Task,
  text: string,
  context?: string,
  onChunk?: OnChunk
): Promise<string> {
  // Relue à chaque appel : un changement de modèle dans les réglages prend effet
  // immédiatement (cf. getLlmSelection).
  const { provider, model } = getLlmSelection()
  const local = isLocal(provider)
  const controller = new AbortController()
  activeControllers.add(controller)
  startActivity(local ? 'local' : 'cloud', model, task)
  try {
    const { text: output, usage } = await dispatchComplete(
      provider,
      task,
      text,
      context,
      model,
      controller.signal,
      onChunk
    )
    endActivity(usage)
    if (!local && usage) addCost(costOf(model, usage))
    // Trace le prompt EXACT (même fonction que les moteurs) et la réponse.
    if (isAiDebug()) {
      const { system, user } = buildPrompt(task, text, context)
      logCompletion({ task, provider, model, system, user, response: output })
    }
    return output
  } catch (error) {
    endActivity()
    // Annulation volontaire (Échap) : ni toast ni bruit, on relaie juste le rejet.
    if (!controller.signal.aborted && !isAbort(error)) {
      reportAiError(error, local ? 'local' : 'cloud', model)
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
    if (!local && usage) addCost(costOf(model, usage))
    return embeddings
  } catch (error) {
    endActivity()
    reportAiError(error, local ? 'local' : 'cloud', model)
    throw error
  }
}
