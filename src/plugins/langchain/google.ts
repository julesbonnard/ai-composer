import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

export function getEmbeddings(
  model: string = "sentence-transformers/all-MiniLM-L6-v2",
) {
  return new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001", // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY
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
      apiKey: import.meta.env.VITE_GOOGLE_API_KEY
  })
}
