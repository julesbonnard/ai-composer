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
  gateway: {
    local: false,
    llm: [
      'openai/gpt-5.4',
      'anthropic/claude-sonnet-4.6',
      'google/gemini-3-flash',
      'mistral/mistral-large'
    ],
    embeddings: [], // le Gateway ne fait pas d'embeddings → embeddings toujours locaux
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
  // --- Local : MediaPipe Tasks GenAI ---
  taskgenai: {
    local: true,
    llm: ['gemma3-1b-it-int4.task', 'gemma2-2b-it-gpu-int8.bin'],
    embeddings: [],
    auth: false
  },
  // --- Local : Ollama (serveur local de l'utilisateur) ---
  ollama: {
    local: true,
    llm: ['llama3.2'],
    embeddings: ['mxbai-embed-large'],
    auth: false
  }
}

export default models
