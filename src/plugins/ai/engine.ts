import modelsConfig from '../../config/models'
import { llmSelection, embeddingsSelection } from './selection'
import type { Task } from './prompts'
import { remoteComplete } from './engines/remote'
import { localComplete, localEmbed } from './engines/local'

// Unique point de bascule local ↔ distant : on lit le flag `local` du provider
// sélectionné dans config/models.ts. Changer de modèle = changer de provider dans
// les réglages, rien d'autre dans le code.
function isLocal(provider: string): boolean {
  return Boolean((modelsConfig as Record<string, { local?: boolean }>)[provider]?.local)
}

// Repli si l'utilisateur sélectionne un provider d'embeddings non local : le Gateway
// ne fait pas d'embeddings, on garde donc un modèle local par défaut (multilingue).
const DEFAULT_LOCAL_EMBEDDING = 'Xenova/multilingual-e5-small'

export function complete(task: Task, text: string, context?: string): Promise<string> {
  return isLocal(llmSelection.provider)
    ? localComplete(task, text, context, llmSelection.model)
    : remoteComplete(task, text, context, llmSelection.model)
}

export function embed(texts: string[]): Promise<number[][]> {
  const model = isLocal(embeddingsSelection.provider)
    ? embeddingsSelection.model
    : DEFAULT_LOCAL_EMBEDDING
  return localEmbed(texts, model)
}
