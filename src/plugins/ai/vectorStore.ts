import { embed, embedMany } from 'ai'
import { getEmbeddingModel } from './factory'
import { embeddingsSelection } from './selection'

// Document léger, structurellement compatible avec l'ancien Document LangChain
// (pageContent + metadata + id) consommé par Autocompletion.ts.
export interface Doc {
  id: string
  pageContent: string
  metadata: { title: string; id: string }
}

interface StoredChunk {
  vector: number[]
  doc: Doc
}

// Vector store en mémoire (non persisté). Cf. ROADMAP phase D pour la persistance.
const chunks: StoredChunk[] = []

function embeddingModel() {
  return getEmbeddingModel(embeddingsSelection.provider, embeddingsSelection.model)
}

// Découpage récursif simple (équivalent RecursiveCharacterTextSplitter : 1000/200).
function splitText(text: string, size = 1000, overlap = 200): string[] {
  if (text.length <= size) return [text]
  const pieces: string[] = []
  let start = 0
  while (start < text.length) {
    pieces.push(text.slice(start, start + size))
    start += size - overlap
  }
  return pieces
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export async function addDocuments(docs: Doc[]): Promise<void> {
  const pieces = docs.flatMap((doc) =>
    splitText(doc.pageContent).map((content) => ({
      content,
      metadata: doc.metadata
    }))
  )
  if (pieces.length === 0) return

  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: pieces.map((p) => p.content)
  })

  pieces.forEach((piece, i) => {
    chunks.push({
      vector: embeddings[i],
      doc: {
        id: piece.metadata.id,
        pageContent: piece.content,
        metadata: piece.metadata
      }
    })
  })
}

// Recherche par similarité cosinus, puis dédoublonnage par source pour proposer
// une complétion issue de sources distinctes (intention produit : « une complétion
// par source »).
export async function similaritySearch(query: string, k = 4): Promise<Doc[]> {
  if (chunks.length === 0) return []

  const { embedding } = await embed({
    model: embeddingModel(),
    value: query
  })

  const scored = chunks
    .map((chunk) => ({ doc: chunk.doc, score: cosineSimilarity(embedding, chunk.vector) }))
    .sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const results: Doc[] = []
  for (const { doc } of scored) {
    if (seen.has(doc.metadata.id)) continue
    seen.add(doc.metadata.id)
    results.push(doc)
    if (results.length >= k) break
  }
  return results
}
