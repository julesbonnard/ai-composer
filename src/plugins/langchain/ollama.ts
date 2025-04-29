import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

export function getEmbeddings(model: string) {
  return new OllamaEmbeddings({
    baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL,
    model
  })
}

export function getLLM(model: string, options?: any) {
  const defaultOptions = {
    stop: ['\n'],
    temperature: 0.3,
    cache: true
  }
  return new ChatOllama({
    baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL,
    model,
    ...defaultOptions,
    ...options
  });
}