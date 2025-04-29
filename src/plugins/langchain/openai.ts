import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'

export function getEmbeddings(model: string) {
  return new OpenAIEmbeddings({
    apiKey: import.meta.env.VITE_OPENAI_APIKEY,
    model
  })
}

export function getLLM(model: string, options?: any) {
  const defaultOptions = {
    temperature: 0.3,
    maxTokens: undefined,
    timeout: undefined,
    maxRetries: 2,
    cache: true
  }
  return new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_APIKEY,
    model,
    ...defaultOptions,
    ...options
  })
}
