import modelsConfig from '../../config/models'

export type ProviderKey = keyof typeof modelsConfig

export interface Selection {
  provider: ProviderKey
  model: string
}

// Lit la sélection persistée par le store settings (useStorage, clé localStorage).
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

const LLM_KEY = 'ai-composer-llm-selection'
const EMBEDDINGS_KEY = 'ai-composer-embeddings-selection'

// Défaut : Claude Sonnet 4.6 — seul modèle testé à NE PAS fabriquer de faits absents
// des sources (cf. scripts/autocomplete-bench.ts ; Gemini Flash-Lite et Claude Haiku
// hallucinent, Gemini 3 raisonne trop pour de l'inline). Exactitude > coût en journalisme.
const LLM_FALLBACK: Selection = { provider: 'gateway', model: 'anthropic/claude-sonnet-4.6' }
const EMBEDDINGS_FALLBACK: Selection = { provider: 'transformers', model: 'Xenova/multilingual-e5-small' }

// Génération : relue à CHAQUE appel → changer de provider/modèle prend effet
// immédiatement, sans rechargement (la génération est sans état).
export function getLlmSelection(): Selection {
  return getStoredSelection(LLM_KEY, LLM_FALLBACK)
}

// Embeddings : figée AU CHARGEMENT du module. Elle doit rester cohérente avec le
// vector store hydraté/réconcilié cette session (clé `chunks:<modèle>`, dimensions).
// Changer de modèle d'embeddings nécessite donc un rechargement (cf. ModelSelector,
// qui invite à recharger en comparant à `embeddingsSelection`).
export const embeddingsSelection = getStoredSelection(EMBEDDINGS_KEY, EMBEDDINGS_FALLBACK)
