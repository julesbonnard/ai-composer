import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";

export function getEmbeddings(model: string = "mistral-embed") {
  return new MistralAIEmbeddings({
    apiKey: import.meta.env.VITE_MISTRALAI_APIKEY,
    model,
  });
}

export function getLLM(modelName: string = "mistral-small") {
  return new ChatMistralAI({
    apiKey: import.meta.env.VITE_MISTRALAI_APIKEY,
    modelName,
  });
}
