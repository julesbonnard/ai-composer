import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'

function getApiKey(): string {
  const storedKeys = localStorage.getItem('ai-composer-api-keys')
  if (storedKeys) {
    try {
      const keys = JSON.parse(storedKeys)
      if (keys.openai) return keys.openai
    } catch (e) {
      // Fallback to env if parsing fails
    }
  }
  return import.meta.env.VITE_OPENAI_API_KEY
}

export function getEmbeddings(model: string = 'text-embedding-3-large') {
  return new OpenAIEmbeddings({
    apiKey: getApiKey(),
    model
  })
}

export function getLLM(model: string = 'gpt-4', options?: any) {
  const defaultOptions = {
    temperature: 0.3,
    maxTokens: undefined,
    timeout: undefined,
    maxRetries: 2,
    cache: true
  }
  return new ChatOpenAI({
    apiKey: getApiKey(),
    model,
    ...defaultOptions,
    ...options
  })
}
