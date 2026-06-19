import { embedMany, APICallError } from 'ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { rateLimit } from './_rateLimit.js'
import models from '../src/config/models.js'

// Embeddings via le Vercel AI Gateway côté serveur (auth OIDC — jamais exposée au
// client), calqué sur api/llm.ts. Le Gateway route bien les modèles d'embeddings
// (cf. doc AI Gateway « Embeddings ») : slug provider/model + embedMany.
const DEFAULT_MODEL = 'openai/text-embedding-3-small'
const ALLOWED_MODELS = new Set(models.gateway?.embeddings ?? [DEFAULT_MODEL])

const MAX_TEXTS = 256
const MAX_TOTAL_CHARS = 100_000

const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,
  'https://ai-composer.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean) as string[]

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true
  return ALLOWED_ORIGINS.some((o) => origin === o)
}

function userIdFromRequest(request: VercelRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim()
  return createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16)
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json({ error: 'Forbidden origin' })
  }
  // Anti-abus par IP. Limite plus haute que /api/llm : les embeddings partent en salves
  // (réconciliation des sources au chargement, requête de ranking par Tab).
  const rl = rateLimit(request, { limit: 60 })
  if (!rl.ok) {
    response.setHeader('Retry-After', String(rl.retryAfter))
    return response.status(429).json({ error: 'Trop de requêtes, réessayez dans un instant.' })
  }

  try {
    const { texts, model } = request.body as { texts?: string[]; model?: string }

    if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS) {
      return response.status(400).json({ error: 'Missing or oversized texts array' })
    }
    if (texts.some((t) => typeof t !== 'string')) {
      return response.status(400).json({ error: 'Texts must be strings' })
    }
    if (texts.reduce((acc, t) => acc + t.length, 0) > MAX_TOTAL_CHARS) {
      return response.status(400).json({ error: 'Oversized input' })
    }

    const requestedModel = model && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL

    const { embeddings, usage } = await embedMany({
      model: requestedModel,
      values: texts,
      providerOptions: {
        gateway: {
          user: userIdFromRequest(request),
          tags: ['app:ai-composer', 'task:embed']
        }
      }
    })

    return response.status(200).json({ embeddings, usage: { tokens: usage?.tokens } })
  } catch (error: any) {
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
    console.error('Embed error:', error)
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return response.status(status).json({ error: error?.message || 'Embed request failed' })
  }
}
