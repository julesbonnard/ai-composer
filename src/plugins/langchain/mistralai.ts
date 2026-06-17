import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";

function getApiKey(): string {
  const storedKeys = localStorage.getItem('ai-composer-api-keys')
  if (storedKeys) {
    try {
      const keys = JSON.parse(storedKeys)
      if (keys.mistralai) return keys.mistralai
    } catch (e) {
      // Fallback to env if parsing fails
    }
  }
  return import.meta.env.VITE_MISTRALAI_APIKEY
}

export function getEmbeddings(model: string = "mistral-embed") {
  return new MistralAIEmbeddings({
    apiKey: getApiKey(),
    model,
  });
}

export function getLLM(modelName: string = "mistral-small") {
  return new ChatMistralAI({
    apiKey: getApiKey(),
    modelName,
  });
}
