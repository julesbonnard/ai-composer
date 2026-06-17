import { createOpenAI } from '@ai-sdk/openai'
import { createMistral } from '@ai-sdk/mistral'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel, EmbeddingModel } from 'ai'

// Providers cloud branchés sur le Vercel AI SDK. Les providers locaux
// (transformers, webLLM, taskgenai, ollama) restent à rebrancher — cf. ROADMAP.md.
export type ProviderKey = 'openai' | 'mistralai' | 'google' | 'anthropic'

const DEFAULT_LLM: Record<ProviderKey, string> = {
  openai: 'gpt-4',
  mistralai: 'mistral-small',
  google: 'gemini-2.5-pro',
  anthropic: 'claude-sonnet-4-6'
}

const DEFAULT_EMBEDDINGS: Record<string, string> = {
  openai: 'text-embedding-3-large',
  mistralai: 'mistral-embed',
  google: 'gemini-embedding-001'
}

// Clé d'API : localStorage (saisie utilisateur) avec repli sur les variables VITE_*.
function getApiKey(provider: ProviderKey): string | undefined {
  const stored = localStorage.getItem('ai-composer-api-keys')
  if (stored) {
    try {
      const keys = JSON.parse(stored)
      const key = keys[provider]
      if (typeof key === 'string' && key) return key
    } catch {
      // repli sur l'environnement
    }
  }
  const fromEnv: Record<ProviderKey, string | undefined> = {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    mistralai: import.meta.env.VITE_MISTRALAI_APIKEY,
    google: import.meta.env.VITE_GOOGLE_API_KEY,
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY
  }
  return fromEnv[provider]
}

export function getLanguageModel(provider: ProviderKey, model?: string): LanguageModel {
  const apiKey = getApiKey(provider)
  const id = model || DEFAULT_LLM[provider]
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey }).languageModel(id)
    case 'mistralai':
      return createMistral({ apiKey }).languageModel(id)
    case 'google':
      return createGoogleGenerativeAI({ apiKey }).languageModel(id)
    case 'anthropic':
      // Autorise l'appel direct depuis le navigateur (BYO-key). À déplacer
      // derrière un proxy serveur pour une utilisation en production.
      return createAnthropic({
        apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
      }).languageModel(id)
  }
}

export function getEmbeddingModel(provider: ProviderKey, model?: string): EmbeddingModel {
  const apiKey = getApiKey(provider)
  const id = model || DEFAULT_EMBEDDINGS[provider]
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey }).textEmbeddingModel(id)
    case 'mistralai':
      return createMistral({ apiKey }).textEmbeddingModel(id)
    case 'google':
      return createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(id)
    default:
      throw new Error(`Le provider « ${provider} » ne fournit pas d'embeddings`)
  }
}
