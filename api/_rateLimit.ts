import { createHash } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

// Rate-limiting par IP, EN MÉMOIRE (fenêtre fixe). Anti-abus pour la démo publique.
// ⚠️ Best-effort : sur Fluid Compute les instances sont réutilisées entre requêtes
// (un même abuseur frappant une instance chaude est freiné), mais l'état n'est PAS
// partagé entre instances/régions → ce n'est pas un mur étanche. Le vrai filet de
// sécurité reste le PLAFOND BUDGET du AI Gateway (dashboard Vercel). Pour un rate-limit
// robuste et global, brancher Upstash Ratelimit (store partagé).

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function clientKey(request: VercelRequest): string {
  const fwd = request.headers['x-forwarded-for']
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || 'unknown'
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function rateLimit(
  request: VercelRequest,
  { limit, windowMs = 60_000 }: { limit: number; windowMs?: number }
): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const key = clientKey(request)
  const b = buckets.get(key)

  if (!b || now >= b.resetAt) {
    // Purge opportuniste des entrées expirées pour borner la mémoire.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  b.count++
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  return { ok: true, retryAfter: 0 }
}
