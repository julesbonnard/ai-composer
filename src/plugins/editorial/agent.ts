// Agent éditorial (headless) : l'orchestrateur qui IMPORTE les tools de stylecheck
// (`lint` déterministe + `judge` sémantique) et exécute la couche IA À LA DEMANDE
// (jamais à la frappe — cf. panneau : bouton « Analyser (IA) »).
//
// Le modèle est fourni par un callModel qui passe par /api/judge (Vercel AI Gateway
// côté serveur, clé jamais exposée au client). judge() sélectionne les skills dans
// le scope, les fait tourner, et renvoie des Diagnostic[] au même schéma.

import { judge, type CallModel, type Diagnostic, type Dispatch } from 'stylecheck'

const JUDGE_API = '/api/judge'

/** callModel branché sur l'endpoint serveur (le prompt est construit par judge()). */
const judgeCallModel: CallModel = async (system, user) => {
  const response = await fetch(JUDGE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user })
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.error || `Judge request failed: ${response.statusText}`)
  }
  const data = (await response.json()) as { text: string }
  return data.text
}

/** Exécute la couche sémantique sur une dépêche → Diagnostic[] (à la demande). */
export function runEditorialAgent(dispatch: Dispatch): Promise<Diagnostic[]> {
  return judge(dispatch, judgeCallModel)
}
