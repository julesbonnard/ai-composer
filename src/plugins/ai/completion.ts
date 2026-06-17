import { generateText } from 'ai'
import { getLanguageModel } from './factory'
import { llmSelection } from './selection'
import type { Doc } from './vectorStore'

function languageModel() {
  return getLanguageModel(llmSelection.provider, llmSelection.model)
}

export async function autocompleteText(text: string, document: Doc): Promise<Completion> {
  const prompt = `You are an artificial intelligence designed to assist a journalist in writing an article by completing their sentences.
Instructions:
- Give a short answer: one sentence, neutral tone.
- If the excerpt does not allow completing the sentence, say nothing.
- If the answer includes a number, specify the units and, if needed, the source.
- Do not rewrite the exact words of the excerpt unless it is a quotation in quotation marks; in that case, keep the quotation marks and state the speaker. For example: "[a quote]," according to [a company], or "[a quote]," said [a spokesperson].
- If the excerpt is in a different language, respond in the language of the current article.
- The answer must be concise and factual, even if it is a single word.
- Use only the information provided in the context.
- Write in the same language as the input.
Context: ${document.pageContent}
Text: ${text}`

  const { text: output } = await generateText({ model: languageModel(), prompt })

  let content = output
  if (content.toLowerCase().startsWith(text.toLowerCase())) {
    content = content.slice(text.length)
  }

  return { answer: content, context: document }
}

export async function shortenText(text: string): Promise<string> {
  const prompt = `You are an AI editing assistant for a journalist. Your task is to propose a shortened version of the selected text while preserving its meaning and accuracy.
Rules:
Reduce the text to the minimum necessary while keeping all essential information.
Do not remove important factual elements.
If the text contains numbers, units, or quotations, retain them exactly.
Do not rephrase unless it provides meaningful concision without altering the meaning.
Do not change the language of the text.
Provide no explanation — only the shortened version.

Example:
Selected text: "The president announced this morning a series of new measures to fight inflation."
Response: "The president announced new measures to fight inflation."

Text: ${text}`

  const { text: output } = await generateText({ model: languageModel(), prompt })
  return output
}

export async function alternativeText(text: string): Promise<string> {
  const prompt = `You are an AI editing assistant for a journalist. Your task is to suggest a synonym when a single word is selected, or a rephrased alternative when a group of words is selected, while preserving the original meaning and intention.
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

Text: ${text}`

  const { text: output } = await generateText({ model: languageModel(), prompt })
  return output
}
