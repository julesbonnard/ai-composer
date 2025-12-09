import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

function getApiKey(): string {
  const storedKeys = localStorage.getItem('ai-composer-api-keys')
  if (storedKeys) {
    try {
      const keys = JSON.parse(storedKeys)
      if (keys.google) return keys.google
    } catch (e) {
      // Fallback to env if parsing fails
    }
  }
  return import.meta.env.VITE_GOOGLE_API_KEY
}

export function getEmbeddings(
  model: string = "gemini-embedding-001",
) {
  return new GoogleGenerativeAIEmbeddings({
    model, // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: getApiKey()
  });
}

export function getLLM(
  model: string = "gemini-2.5-pro",
) {
  return new ChatGoogleGenerativeAI({
      model,
      temperature: 0,
      maxRetries: 2,
      // other params...
      apiKey: getApiKey()
  })
}
