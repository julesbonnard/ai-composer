// Point d'entrée du module IA (Vercel AI SDK), ex-LangChain.js.
// Conserve la même API publique consommée par HomeView.vue et le store sources.
export type { Doc, RankedSource } from './vectorStore'
export {
  addDocuments,
  rankSources,
  buildSourceContext,
  presentSourceIds,
  removeDocuments,
  clearChunks
} from './vectorStore'
export { autocompleteText, shortenText, alternativeText } from './completion'
export { abortGeneration } from './engine'
export { getLlmSelection, embeddingsSelection } from './selection'
