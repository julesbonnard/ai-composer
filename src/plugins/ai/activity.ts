import { reactive } from 'vue'

// État réactif de l'activité IA, consommé par AiActivityBadge.vue : indique en
// continu si une génération est en cours, sur quel moteur (cloud Gateway ou local
// navigateur), quel modèle, et les tokens consommés (entrée/sortie).
//
// Les tokens sont exacts dans les deux modes : usage renvoyé par le Gateway côté
// distant (api/llm.ts), comptés via le tokenizer du worker côté local.

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
}

export type AiMode = 'cloud' | 'local'

export interface AiActivityState {
  active: boolean
  mode: AiMode | null
  model: string
  task: string | null
  usage: TokenUsage | null
}

export const aiActivity = reactive<AiActivityState>({
  active: false,
  mode: null,
  model: '',
  task: null,
  usage: null
})

// Compteur de requêtes concurrentes : l'autocomplétion lance une génération par
// source en parallèle. On reste « actif » tant qu'au moins une requête tourne, et
// on cumule les tokens d'une même salve (remis à zéro au début de la salve suivante).
let pending = 0

export function startActivity(mode: AiMode, model: string, task: string) {
  if (pending === 0) {
    aiActivity.usage = null
  }
  pending++
  aiActivity.active = true
  aiActivity.mode = mode
  aiActivity.model = model
  aiActivity.task = task
}

export function endActivity(usage?: TokenUsage) {
  if (usage) {
    aiActivity.usage = {
      inputTokens: (aiActivity.usage?.inputTokens ?? 0) + (usage.inputTokens ?? 0),
      outputTokens: (aiActivity.usage?.outputTokens ?? 0) + (usage.outputTokens ?? 0)
    }
  }
  pending = Math.max(0, pending - 1)
  if (pending === 0) {
    aiActivity.active = false
  }
}
