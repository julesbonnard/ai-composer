import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";

const aiProviders = {
  ollama: () => import('./ollama'),
  openai: () => import('./openai'),
  mistralai: () => import('./mistralai'),
  transformers: () => import('./transformers'),
}

const embeddingsProvider = {
  provider: 'ollama', // 'openai', 'ollama', 'transformers'
  model: 'mxbai-embed-large' // 'text-embedding-3-large', 'mxbai-embed-large', 'Xenova/all-MiniLM-L6-v2'
}

const llmProvider = {
  provider: 'mistralai', // 'openai', 'mistralai', 'ollama', 'transformers'
  model: 'mistral-small', // 'gpt-4', 'mistral-small', 'llama3.2', ''
  options: {}
}

const { getEmbeddings } = await aiProviders[embeddingsProvider.provider as keyof typeof aiProviders]();
const embeddings = getEmbeddings(embeddingsProvider.model);

const { getLLM } = await aiProviders[llmProvider.provider as keyof typeof aiProviders]();
const llm = getLLM(llmProvider.model, llmProvider.options);

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

function splitDocuments(docs: Document[]) {
  return textSplitter.splitDocuments(docs);
}

const vectorStore = new MemoryVectorStore(embeddings);

export function addDocuments(docs: Document[]) {
  return splitDocuments(docs).then(documents => vectorStore.addDocuments(documents));
}

const mmrRetriever = vectorStore.asRetriever({
  searchType: "mmr",
  searchKwargs: {
    fetchK: 10,
  },
  k: 4
});

export function similaritySearch(query: string) {
  return mmrRetriever.invoke(query);
}

export function getChatCompletion (messages: BaseLanguageModelInput, options?: any) {
  return llm.invoke(messages, options)
}

export function getChatCompletionStream (messages: BaseLanguageModelInput, options?: any) {
  return llm.stream(messages, options)
}