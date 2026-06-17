import type { ProviderKey } from './factory'

export interface Selection {
  provider: ProviderKey
  model: string
}

// Lit la sélection persistée par le store settings (useStorage). Lue une fois au
// chargement du module : changer de provider/modèle nécessite un rechargement,
// comme dans l'implémentation LangChain précédente.
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
  provider: 'openai',
  model: 'gpt-4'
})

export const embeddingsSelection = getStoredSelection('ai-composer-embeddings-selection', {
  provider: 'openai',
  model: 'text-embedding-3-large'
})
