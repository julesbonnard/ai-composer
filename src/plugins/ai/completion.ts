import { complete } from './engine'
import type { Doc } from './vectorStore'

// API de complétion, agnostique du moteur (local ou distant) : tout passe par
// engine.complete(), qui choisit l'implémentation selon le provider sélectionné.

export async function autocompleteText(text: string, document: Doc): Promise<Completion> {
  const answer = await complete('autocomplete', text, document.pageContent)

  let content = answer
  if (content.toLowerCase().startsWith(text.toLowerCase())) {
    content = content.slice(text.length)
  }

  return { answer: content, context: document }
}

export function shortenText(text: string): Promise<string> {
  return complete('shorten', text)
}

export function alternativeText(text: string): Promise<string> {
  return complete('alternative', text)
}
