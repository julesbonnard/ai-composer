import { streamText, APICallError } from 'ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { buildPrompt, type Task } from '../src/plugins/ai/prompts.js'
import { rateLimit } from './_rateLimit.js'
import models from '../src/config/models.js'

// Endpoint à tâches journalistiques figées (pas un proxy LLM ouvert), branché sur le
// Vercel AI Gateway côté serveur. Auth Gateway via OIDC (VERCEL_OIDC_TOKEN) — jamais
// exposée au client. Défenses anti-abus (démo publique sans login) :
//  - vérification d'origine + méthode,
//  - allowlist de modèles (source unique : config/models.ts → gateway.llm),
//  - garde de taille d'entrée (coût),
//  - identifiant utilisateur dérivé de l'IP (hachée) + tags pour rate-limit/budget Gateway
//    (à configurer dans le dashboard Vercel → AI Gateway).
//
// ⚠️ Signature Node `(req, res)` (et NON Web Request→Response) : c'est ce que le runtime
// @vercel/node passe à ce fichier. Le streaming se fait par `res.write` ; les en-têtes
// `X-Accel-Buffering: no` + `Cache-Control: no-transform` + `res.flushHeaders()` évitent
// que le proxy bufferise la réponse (sinon les deltas arrivent tous d'un coup à la fin).
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'
const ALLOWED_MODELS = new Set(models.gateway?.llm ?? [DEFAULT_MODEL])

const MAX_TEXT = 8_000
const MAX_CONTEXT = 16_000

// Origines autorisées (démo prod + dev local). Surchargeable via ALLOWED_ORIGIN.
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,
  'https://ai-composer.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean) as string[]

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true // requêtes same-origin (pas d'en-tête Origin)
  return ALLOWED_ORIGINS.some((o) => origin === o)
}

function userIdFromRequest(request: VercelRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim()
  // Haché pour ne pas stocker l'IP en clair dans les logs Gateway.
  return createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16)
}

// Mappe une erreur (Gateway ou autre) vers un statut HTTP + message lisible.
function friendlyError(error: unknown): { status: number; message: string } {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return { status: 429, message: 'Rate limit atteint, réessayez plus tard.' }
    if (error.statusCode === 402) return { status: 402, message: 'Budget IA épuisé pour le moment.' }
  }
  const status = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500
  return { status, message: (error as any)?.message || 'LLM request failed' }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json({ error: 'Forbidden origin' })
  }
  // Anti-abus : génération = appels payants. Plafond par IP (le backstop dur reste le
  // budget AI Gateway). 30/min couvre largement un rédacteur, freine le martèlement scripté.
  const rl = rateLimit(request, { limit: 30 })
  if (!rl.ok) {
    response.setHeader('Retry-After', String(rl.retryAfter))
    return response.status(429).json({ error: 'Trop de requêtes, réessayez dans un instant.' })
  }

  try {
    const { task, text, context, model } = request.body as {
      task?: Task
      text?: string
      context?: string
      model?: string
    }

    if (!task || !['autocomplete', 'shorten', 'alternative'].includes(task)) {
      return response.status(400).json({ error: 'Invalid or missing task' })
    }
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT) {
      return response.status(400).json({ error: 'Missing or oversized text' })
    }
    if (context !== undefined && (typeof context !== 'string' || context.length > MAX_CONTEXT)) {
      return response.status(400).json({ error: 'Oversized context' })
    }

    const requestedModel = model && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL

    // onError capture la VRAIE cause (sinon le SDK ne remonte qu'un générique
    // « No output generated »). onFinish fournit l'usage exact.
    let streamErr: unknown = null
    let usage: { inputTokens?: number; outputTokens?: number } | undefined
    const { system, user } = buildPrompt(task, text, context)
    const result = streamText({
      model: requestedModel,
      system,
      prompt: user,
      providerOptions: {
        gateway: {
          user: userIdFromRequest(request),
          tags: ['app:ai-composer', `task:${task}`]
        }
      },
      onError: ({ error }) => {
        streamErr = error
        console.error('LLM stream error:', error)
      },
      onFinish: ({ totalUsage }) => {
        usage = { inputTokens: totalUsage?.inputTokens, outputTokens: totalUsage?.outputTokens }
      }
    })

    // En-têtes différés : tant qu'aucun octet n'est parti, on peut encore renvoyer un
    // vrai statut (429/402/5xx). Les en-têtes anti-buffering évitent que le flux soit
    // bufferisé par le proxy (sinon les deltas arrivent d'un coup).
    let started = false
    const start = () => {
      if (started) return
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      response.setHeader('Cache-Control', 'no-cache, no-transform')
      response.setHeader('X-Accel-Buffering', 'no')
      response.flushHeaders?.()
      started = true
    }
    const write = (obj: unknown) => response.write(JSON.stringify(obj) + '\n')

    // streamText avec onError n'effectue PAS de throw dans textStream : la boucle se
    // termine et l'erreur est dans `streamErr`.
    for await (const delta of result.textStream) {
      if (delta) {
        start()
        write({ delta })
      }
    }

    // Erreur survenue AVANT tout octet → vrai statut HTTP (en-têtes pas encore envoyés).
    if (streamErr && !started) throw streamErr
    // Erreur en cours de flux → ligne {"error"} (statut déjà 200).
    if (streamErr) {
      start()
      write({ error: friendlyError(streamErr).message })
      return response.end()
    }
    // Cas normal (y compris réponse vide sans erreur) : on ouvre le flux et renvoie l'usage.
    start()
    write({ usage: usage ?? {} })
    return response.end()
  } catch (error: any) {
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      const retryAfter = error.responseHeaders?.['retry-after']
      if (retryAfter) response.setHeader('Retry-After', retryAfter)
    }
    const { status, message } = friendlyError(error)
    if (status >= 500) console.error('LLM error:', error)
    return response.status(status).json({ error: message })
  }
}
