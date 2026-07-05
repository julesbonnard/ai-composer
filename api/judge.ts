import { generateText, APICallError } from 'ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rateLimit } from './_rateLimit.js'
import models from '../src/config/models.js'

// Endpoint du JUGE ÉDITORIAL (couche sémantique du linter stylecheck). Reçoit un
// prompt {system, user} déjà construit par l'orchestrateur judge() côté client et
// renvoie le TEXTE brut de la réponse (censé être un tableau JSON de findings).
// Branché sur le Vercel AI Gateway côté serveur (clé/OIDC jamais exposée au client),
// même posture anti-abus que /api/llm : origine, allowlist de modèles, taille, rate-limit.
//
// Non-streaming (contrairement à /api/llm) : le juge produit un petit JSON structuré
// consommé d'un bloc, pas un flux de rédaction.

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'
const ALLOWED_MODELS = new Set(models.gateway?.llm ?? [DEFAULT_MODEL])

const MAX_SYSTEM = 24_000
const MAX_USER = 24_000

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

function friendlyError(error: unknown): { status: number; message: string } {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return { status: 429, message: 'Rate limit atteint, réessayez plus tard.' }
    if (error.statusCode === 402) return { status: 402, message: 'Budget IA épuisé pour le moment.' }
  }
  const status = typeof (error as { statusCode?: number })?.statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : 500
  return { status, message: (error as { message?: string })?.message || 'Judge request failed' }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (!isAllowedOrigin(request.headers.origin)) return response.status(403).json({ error: 'Forbidden origin' })

  const rl = rateLimit(request, { limit: 20 })
  if (!rl.ok) {
    response.setHeader('Retry-After', String(rl.retryAfter))
    return response.status(429).json({ error: 'Trop de requêtes, réessayez dans un instant.' })
  }

  const { system, user, model } = (request.body ?? {}) as {
    system?: string
    user?: string
    model?: string
  }
  if (!system || !user) return response.status(400).json({ error: 'system et user requis' })
  if (system.length > MAX_SYSTEM || user.length > MAX_USER)
    return response.status(413).json({ error: 'Prompt trop long' })

  const requestedModel = model && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL

  try {
    const { text } = await generateText({
      model: requestedModel,
      system,
      prompt: user,
      temperature: 0, // jugement déterministe et reproductible
      providerOptions: {
        gateway: { tags: ['app:ai-composer', 'task:judge'] }
      }
    })
    return response.status(200).json({ text })
  } catch (error) {
    const { status, message } = friendlyError(error)
    console.error('Judge error:', error)
    return response.status(status).json({ error: message })
  }
}
