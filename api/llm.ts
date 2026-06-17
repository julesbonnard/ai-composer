import { generateText, APICallError } from 'ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { buildPrompt, type Task } from '../src/plugins/ai/prompts'
import models from '../src/config/models'

// Endpoint à tâches journalistiques figées (pas un proxy LLM ouvert), branché sur le
// Vercel AI Gateway côté serveur. Auth Gateway via OIDC (VERCEL_OIDC_TOKEN) — jamais
// exposée au client. Défenses anti-abus (démo publique sans login) :
//  - vérification d'origine + méthode,
//  - allowlist de modèles (source unique : config/models.ts → gateway.llm),
//  - garde de taille d'entrée (coût),
//  - identifiant utilisateur dérivé de l'IP (hachée) + tags pour rate-limit/budget Gateway
//    (à configurer dans le dashboard Vercel → AI Gateway).
// Défaut bon marché, compatible free tier ($5/mois). Doit figurer dans gateway.llm.
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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json({ error: 'Forbidden origin' })
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

    const { text: output } = await generateText({
      model: requestedModel,
      prompt: buildPrompt(task, text, context),
      providerOptions: {
        gateway: {
          user: userIdFromRequest(request),
          tags: ['app:ai-composer', `task:${task}`]
        }
      }
    })

    return response.status(200).json({ text: output })
  } catch (error: any) {
    // Rate-limit / budget Gateway : on remonte un message exploitable côté client.
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 429) {
        const retryAfter = error.responseHeaders?.['retry-after']
        if (retryAfter) response.setHeader('Retry-After', retryAfter)
        return response.status(429).json({ error: 'Rate limit atteint, réessayez plus tard.' })
      }
      if (error.statusCode === 402) {
        return response.status(402).json({ error: 'Budget IA épuisé pour le moment.' })
      }
    }
    console.error('LLM error:', error)
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return response.status(status).json({ error: error?.message || 'LLM request failed' })
  }
}
