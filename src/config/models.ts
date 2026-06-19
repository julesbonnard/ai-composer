// Catalogue des providers. `local: true` => exécution navigateur (Web Worker
// transformers.js / WebLLM / MediaPipe). `local: false` => Vercel AI Gateway
// (appel côté serveur via /api/llm, slugs `provider/model`).
// Le flag `local` est l'unique critère de bascule (cf. src/plugins/ai/engine.ts).
// `auth: false` partout : le Gateway s'authentifie côté serveur (OIDC), les modèles
// locaux ne demandent pas de clé.
interface ProviderConfig {
  local: boolean
  llm: string[]
  embeddings: string[]
  auth: false | 'apiKey' | 'oauthToken' | 'clientCredentials'
}

const models: Record<string, ProviderConfig> = {
  // --- Distant : Vercel AI Gateway (slugs provider/model, versions en points) ---
  // Modèles bon marché adaptés au free tier ($5 de crédits/mois, prix coûtant).
  // Tarifs indicatifs (input/output par M tokens) au moment de la sélection.
  gateway: {
    local: false,
    llm: [
      // — Économiques (adaptés au free tier $5/mois) —
      'google/gemini-2.5-flash-lite', // $0.10 / $0.40 — défaut : rapide, multilingue
      'openai/gpt-5-nano', // $0.05 / $0.40 — le moins cher OpenAI
      'openai/gpt-4.1-nano', // $0.10 / $0.40
      'mistral/ministral-3b', // $0.10 / $0.10 — très bon marché, solide en français
      'mistral/mistral-small', // $0.10 / $0.30 — français
      'anthropic/claude-3-haiku', // $0.25 / $1.25 — option Anthropic économique
      // — Hors free tier (qualité supérieure, coût plus élevé) —
      'google/gemini-2.5-flash', // flash standard (au-dessus de lite)
      'google/gemini-2.5-pro', // raisonnement Google haut de gamme
      'google/gemini-3-flash', // génération flash la plus récente
      'openai/gpt-5', // OpenAI haut de gamme
      'openai/gpt-4.1', // OpenAI polyvalent
      'mistral/mistral-large-3', // Mistral haut de gamme (français)
      'anthropic/claude-sonnet-4.6', // Anthropic équilibré, excellent en rédaction
      'anthropic/claude-opus-4.8' // Anthropic le plus capable (coût le plus élevé)
    ],
    // Le Gateway route aussi les modèles d'embeddings (slug provider/model, cf.
    // api/embed.ts). Défaut bon marché : openai/text-embedding-3-small.
    embeddings: [
      'openai/text-embedding-3-small', // $0.02 / M — défaut
      'openai/text-embedding-3-large', // $0.13 / M — plus précis
      'google/gemini-embedding-001', // multilingue
      'mistral/mistral-embed' // français
    ],
    auth: false
  },
  // --- Local : transformers.js (ONNX, WebGPU/WASM) ---
  transformers: {
    local: true,
    llm: [
      'onnx-community/Qwen2.5-0.5B-Instruct',
      'onnx-community/Qwen2.5-1.5B-Instruct',
      'HuggingFaceTB/SmolLM2-1.7B-Instruct'
    ],
    embeddings: ['Xenova/multilingual-e5-small', 'Xenova/all-MiniLM-L6-v2'],
    auth: false
  },
  // --- Local : WebLLM (MLC) ---
  webLLM: {
    local: true,
    llm: ['Llama-3.1-8B-Instruct-q4f32_1-MLC', 'Phi-3-mini-4k-instruct'],
    embeddings: ['snowflake-arctic-embed-m-q0f32-MLC-b4'],
    auth: false
  },
  // --- Local : MediaPipe Tasks GenAI (génération uniquement, pas d'embeddings) ---
  // Les .task sont résolus via VITE_TASKGENAI_BASE_URL (cf. engines/taskgenai.ts).
  taskgenai: {
    local: true,
    llm: ['gemma3-1b-it-int4.task', 'gemma2-2b-it-gpu-int8.bin'],
    embeddings: [],
    auth: false
  }
  // Ollama retiré : non câblé dans engine.ts (le serveur local nécessiterait un
  // moteur dédié + CORS). À réintroduire avec son moteur le jour venu.
}

export default models
