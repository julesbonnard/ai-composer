// Comparatif autocomplétion : MÉTHODE (instruite vs prefill assistant) × MODÈLE
// (Gemini vs Claude). But : trancher « problème de méthode ou de modèle ? ».
//
// Lancer (auth Gateway nécessaire) :
//   vercel env pull .env.local        # rafraîchit VERCEL_OIDC_TOKEN (court-lived)
//   bun run scripts/autocomplete-bench.ts
// (ou `pnpm dlx tsx scripts/autocomplete-bench.ts` ; bun auto-charge .env.local)
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateText } from 'ai'
import { buildPrompt } from '../src/plugins/ai/prompts'

// Méthode instruite uniquement (prefill non supporté par le Gateway). On compare des
// modèles sur leur fiabilité d'ANCRAGE (surtout le cas « fait absent »).
const MODELS = [
  { label: 'Gemini 2.5 flash-lite', id: 'google/gemini-2.5-flash-lite' },
  { label: 'Gemini 3 flash', id: 'google/gemini-3-flash' },
  { label: 'Claude 3 haiku', id: 'anthropic/claude-3-haiku' },
  { label: 'Claude Sonnet 4.6', id: 'anthropic/claude-sonnet-4.6' }
]

// Cas représentatifs : { sources, written (déjà écrit), current (phrase en cours) }.
const CASES = [
  {
    name: 'Fait présent dans la source',
    sources:
      "Le gouvernement a présenté lundi son plan de relance. Le budget total prévu atteindra 3,5 milliards d'euros sur cinq ans, a précisé le ministre de l'Économie. Les syndicats ont réagi avec prudence.",
    written: 'Plan de relance : le gouvernement dévoile ses chiffres\nLe gouvernement a présenté son plan lundi.',
    current: 'Le budget prévu atteindra'
  },
  {
    name: 'Début de nouvelle phrase (current vide)',
    sources:
      "Le gouvernement a présenté lundi son plan de relance. Le budget total prévu atteindra 3,5 milliards d'euros sur cinq ans. Les syndicats ont réagi avec prudence.",
    written: 'Le gouvernement a présenté son plan lundi. Le budget atteindra 3,5 milliards d’euros.',
    current: ''
  },
  {
    name: 'Fait ABSENT (doit s’abstenir)',
    sources:
      "Le gouvernement a présenté lundi son plan de relance. Les syndicats ont réagi avec prudence.",
    written: 'Le gouvernement a présenté son plan lundi.',
    current: 'Le nombre exact d’emplois créés sera de'
  }
]

// MÉTHODE 1 — instruite (système + user), via buildPrompt (ce que fait l'app).
async function instructed(model: string, c: (typeof CASES)[number]) {
  const draft = [c.written, c.current].filter(Boolean).join(' ')
  const { system, user } = buildPrompt('autocomplete', draft, c.sources)
  const { text } = await generateText({ model, system, prompt: user, temperature: 0.3, maxOutputTokens: 60 })
  return text.trim()
}

const VARIANTS = MODELS.map((m) => ({ label: m.label, run: (c: (typeof CASES)[number]) => instructed(m.id, c) }))

for (const c of CASES) {
  console.log(`\n\x1b[1m━━━ ${c.name} ━━━\x1b[0m`)
  console.log(`  written: ${JSON.stringify(c.written)}`)
  console.log(`  current: ${JSON.stringify(c.current)}`)
  for (const v of VARIANTS) {
    try {
      const out = await v.run(c)
      console.log(`  \x1b[36m${v.label.padEnd(22)}\x1b[0m → ${JSON.stringify(out)}`)
    } catch (e) {
      console.log(`  \x1b[31m${v.label.padEnd(22)}\x1b[0m ✗ ${(e as Error).message.slice(0, 100)}`)
    }
  }
}
