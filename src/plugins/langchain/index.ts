import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { getVectorStore } from "./vectorStore";

const aiProviders = {
  ollama: () => import("./ollama"),
  openai: () => import("./openai"),
  mistralai: () => import("./mistralai"),
  huggingface: () => import("./huggingface"),
  transformers: () => import("./transformers"),
  webLLM: () => import("./webLLM")
};

export const embeddingsProvider = {
  provider: "transformers",
};

export const llmProvider = {
  provider: "webLLM",
};

const { getEmbeddings } = await aiProviders
  [embeddingsProvider.provider as keyof typeof aiProviders]();

export const { addDocuments, similaritySearch } = getVectorStore(
  getEmbeddings(),
);

const { getLLM } = await aiProviders
  [llmProvider.provider as keyof typeof aiProviders]();

export function getChatCompletion(
  messages: BaseLanguageModelInput,
) {
  return getLLM().invoke(messages);
}

// export function getChatCompletionStream(messages: BaseLanguageModelInput, options?: any) {
//   return llm.stream(messages, options)
// }
