// Observabilité console : trace la recherche de contexte (chunks + scores), le prompt
// EXACT envoyé au LLM et sa réponse. Pensé pour évaluer la pertinence du RAG.
//
// Par défaut : ACTIF en dev (`pnpm dev`), inactif en production. Bascule à chaud sans
// rebuild, depuis la console du navigateur :
//   aiDebug(false)  → couper les logs        aiDebug(true) → les rallumer
// (l'état est mémorisé dans localStorage et prime sur le défaut dev/prod.)

const KEY = 'ai-composer-debug'

export function isAiDebug(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* localStorage indisponible */
  }
  return import.meta.env.DEV
}

// Toggle pratique exposé globalement (console).
if (typeof window !== 'undefined') {
  ;(window as unknown as { aiDebug: (on?: boolean) => string }).aiDebug = (on = true) => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      /* ignore */
    }
    return on ? 'AI debug activé.' : 'AI debug désactivé.'
  }
}

const HDR = 'color:#c026d3;font-weight:bold' // magenta signature IA
const DIM = 'color:#9ca3af'
const LABEL = 'color:#6b7280;font-weight:bold'

function preview(s: string, n = 80): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > n ? clean.slice(0, n) + '…' : clean
}

export interface RetrievedChunk {
  source: string
  score: number
  offset?: number
  text: string
}

// Une ligne par chunk retenu, triée par score décroissant (cf. recherche).
export function logRetrieval(query: string, chunks: RetrievedChunk[]): void {
  if (!isAiDebug()) return
  console.groupCollapsed(
    `%c🔎 RAG%c  ${chunks.length} chunk(s) · requête : %c${preview(query, 60)}`,
    HDR,
    DIM,
    'color:inherit'
  )
  if (chunks.length) {
    console.table(
      chunks.map((c) => ({
        source: c.source,
        score: Number(c.score.toFixed(4)),
        offset: c.offset ?? '',
        extrait: preview(c.text, 100)
      }))
    )
  } else {
    console.log('%c(aucun chunk — store vide ou rien de pertinent)', DIM)
  }
  console.groupEnd()
}

export interface CompletionLog {
  task: string
  provider: string
  model: string
  system: string
  user: string
  response: string
}

// Messages envoyés (system / user) et réponse reçue, pour une tâche.
export function logCompletion(info: CompletionLog): void {
  if (!isAiDebug()) return
  console.groupCollapsed(
    `%c✨ ${info.task}%c  ${info.provider}/${info.model} · → %c${preview(info.response, 50)}`,
    HDR,
    DIM,
    'color:inherit'
  )
  console.log('%cSystem ▼', LABEL)
  console.log(info.system)
  console.log('%cUser ▼', LABEL)
  console.log(info.user)
  console.log('%cRéponse du LLM ▼', LABEL)
  console.log(info.response || '%c(réponse vide)', info.response ? '' : DIM)
  console.groupEnd()
}
