import { generateText } from 'ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPrompt, type Task } from '../src/plugins/ai/prompts'

// Tâches journalistiques figées : l'endpoint ne génère pas de texte arbitraire
// (pas de proxy LLM ouvert), il applique un prompt prédéfini partagé avec le moteur
// local. Cf. ROADMAP : ajouter rate-limiting / budgets AI Gateway pour la démo publique.

// Modèle Gateway par défaut (slug provider/model). Validez la liste réelle via
// gateway.getAvailableModels() ; les slugs versionnés utilisent des points (4.6, pas 4-6).
const DEFAULT_MODEL = 'openai/gpt-5.4'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
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
    if (typeof text !== 'string' || text.length === 0) {
      return response.status(400).json({ error: 'Missing text' })
    }

    // L'authentification AI Gateway est résolue par le SDK via VERCEL_OIDC_TOKEN
    // (ou AI_GATEWAY_API_KEY) — jamais exposée au client.
    const { text: output } = await generateText({
      model: model || DEFAULT_MODEL,
      prompt: buildPrompt(task, text, context),
    })

    return response.status(200).json({ text: output })
  } catch (error: any) {
    console.error('LLM error:', error)
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return response.status(status).json({ error: error?.message || 'LLM request failed' })
  }
}
