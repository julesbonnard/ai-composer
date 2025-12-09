import { getVectorStore } from "./vectorStore";
import { formatDocumentsAsString } from "@langchain/classic/util/document";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { RunnableLambda } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { fetchNewsContext } from "./asknews";
import { RunnableParallel } from "@langchain/core/runnables";
import { type SearchResponse } from '@emergentmethods/asknews-typescript-sdk'

const aiProviders = {
  ollama: () => import("./ollama"),
  openai: () => import("./openai"),
  mistralai: () => import("./mistralai"),
  huggingface: () => import("./huggingface"),
  google: () => import("./google"),
  transformers: () => import("./transformers"),
  webLLM: () => import("./webLLM"),
  taskgenai: () => import("./taskgenai")
};

// Fonction pour lire les sélections depuis localStorage
function getStoredSelection(key: string, defaultProvider: string) {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const selection = JSON.parse(stored)
      return selection
    } catch (e) {
      // Fallback to default if parsing fails
    }
  }
  return { provider: defaultProvider, model: '' }
}

export const embeddingsProvider = getStoredSelection('ai-composer-embeddings-selection', 'openai');

export const llmProvider = getStoredSelection('ai-composer-llm-selection', 'openai');

const { getEmbeddings } = await aiProviders
  [embeddingsProvider.provider as keyof typeof aiProviders]();

export const { addDocuments, similaritySearch } = getVectorStore(
  getEmbeddings(embeddingsProvider.model || undefined),
);

const { getLLM } = await aiProviders
  [llmProvider.provider as keyof typeof aiProviders]();

function searchContextFromDocuments(text: string) {
  return similaritySearch(text);
}

async function searchContextFromAskNews(text: string) {
  const newsContext = await fetchNewsContext(text) as SearchResponse;
  return newsContext.asDicts?.map((item => new Document({
    pageContent: item.keyPoints?.join('\n') || item.summary,
    metadata: { title: `${item.domainUrl} - ${item.articleUrl}` }
  }))) || [];
}

export async function searchContext(text: string) {
  const results = await RunnableParallel.from({
    documents: RunnableLambda.from(searchContextFromDocuments),
    news: RunnableLambda.from(searchContextFromAskNews),
  }).invoke(text)
  
  console.log('searchContext results', results);
  return [...results.documents, ...results.news];
}

export function autocompleteText(text: string, document: Document) {
  const promptTemplate = PromptTemplate.fromTemplate(`You are an artificial intelligence designed to assist a journalist in writing an article by completing their sentences.
Instructions:
- Give a short answer: one sentence, neutral tone.
- If the excerpt does not allow completing the sentence, say nothing.
- If the answer includes a number, specify the units and, if needed, the source.
- Do not rewrite the exact words of the excerpt unless it is a quotation in quotation marks; in that case, keep the quotation marks and state the speaker. For example: “[a quote],” according to [a company], or “[a quote],” said [a spokesperson].
- If the excerpt is in a different language, respond in the language of the current article.
- The answer must be concise and factual, even if it is a single word.
- Use only the information provided in the context.
- Write in the same language as the input.
Context: {context}
Text: {text}`);

  return RunnableSequence.from([
    RunnablePassthrough.assign({
      context: RunnableLambda.from(() => formatDocumentsAsString([document]))
    }),
    promptTemplate,
    getLLM(llmProvider.model || undefined) as any,
    RunnableLambda.from(output => {
      console.log('autocompleteText output', output);
      let content = 'invoke' in output ? output.invoke.content.toString() : output.content.toString()
      if (content.toLowerCase().startsWith(text.toLowerCase())) {
        content = content.slice(text.length)
      }
      return {
        answer: content,
        context: document
      } as Completion;
    })
  ]).invoke({
    text, document
  });
}

export function shortenText(text: string) {
  const promptTemplate = PromptTemplate.fromTemplate(`You are an AI editing assistant for a journalist. Your task is to propose a shortened version of the selected text while preserving its meaning and accuracy.
Rules:
Reduce the text to the minimum necessary while keeping all essential information.
Do not remove important factual elements.
If the text contains numbers, units, or quotations, retain them exactly.
Do not rephrase unless it provides meaningful concision without altering the meaning.
Do not change the language of the text.
Provide no explanation — only the shortened version.

Example:
Selected text: “The president announced this morning a series of new measures to fight inflation.”
Response: “The president announced new measures to fight inflation.”

Text: {text}`);

  return RunnableSequence.from([
    {
      text: new RunnablePassthrough()
    },
    promptTemplate,
    getLLM(llmProvider.model || undefined) as any
  ]).invoke(text);
}

export function alternativeText(text: string) {
  const promptTemplate = PromptTemplate.fromTemplate(`You are an AI editing assistant for a journalist. Your task is to suggest a synonym when a single word is selected, or a rephrased alternative when a group of words is selected, while preserving the original meaning and intention.
Rules:
If a single word is selected, propose a precise, natural synonym in the same register.
If a group of words is selected, rephrase it smoothly without changing the meaning.
Provide only one suggestion.
Do not oversimplify if it alters the intention or tone.
Do not change the language of the text.
Reply only with the alternative proposal, without explanation.

Examples:
Selected word: important → Response: essential
Selected phrase: a controversial decision → Response: a contested measure

Text: {text}`);

  return RunnableSequence.from([
    {
      text: new RunnablePassthrough()
    },
    promptTemplate,
    getLLM(llmProvider.model || undefined) as any
  ]).invoke(text);
}