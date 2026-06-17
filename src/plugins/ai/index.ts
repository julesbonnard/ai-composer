// Point d'entrée du module IA (Vercel AI SDK). Remplace src/plugins/langchain/.
// Conserve la même API publique consommée par HomeView.vue et le store sources.
import { similaritySearch } from './vectorStore'

export type { Doc } from './vectorStore'
export { addDocuments, similaritySearch } from './vectorStore'
export { autocompleteText, shortenText, alternativeText } from './completion'
export { llmSelection, embeddingsSelection } from './selection'

export async function searchContext(text: string) {
  return similaritySearch(text)
}
