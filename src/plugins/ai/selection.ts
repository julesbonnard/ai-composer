import modelsConfig from '../../config/models'

export type ProviderKey = keyof typeof modelsConfig

export interface Selection {
  provider: ProviderKey
  model: string
}

// Lit la sélection persistée par le store settings (useStorage). Lue une fois au
// chargement du module : changer de provider/modèle nécessite un rechargement.
function getStoredSelection(key: string, fallback: Selection): Selection {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      return JSON.parse(stored) as Selection
    } catch {
      // repli
    }
  }
  return fallback
}

export const llmSelection = getStoredSelection('ai-composer-llm-selection', {
  provider: 'gateway',
  model: 'openai/gpt-5.4'
})

export const embeddingsSelection = getStoredSelection('ai-composer-embeddings-selection', {
  provider: 'transformers',
  model: 'Xenova/multilingual-e5-small'
})
