import { embed } from './engine'
import { embeddingsSelection } from './selection'
import { idbGet, idbSet, idbDel, CHUNKS_KEY } from './persistence'

// Document léger, structurellement compatible avec l'ancien Document LangChain
// (pageContent + metadata + id) consommé par Autocompletion.ts.
export interface Doc {
  id: string
  pageContent: string
  // offset = position du chunk (en caractères) dans le contenu de la source.
  metadata: { title: string; id: string; offset?: number }
}

interface StoredChunk {
  vector: number[]
  doc: Doc
}

// Vector store en mémoire, PERSISTÉ dans IndexedDB. La clé inclut le modèle
// d'embeddings courant : changer de modèle (dimensions différentes) repart d'un
// store vide → les sources sont ré-embeddées (cf. stores/sources.ts).
let chunks: StoredChunk[] = []
const storeKey = CHUNKS_KEY(embeddingsSelection.model)

// Hydratation paresseuse (une seule fois) depuis IndexedDB.
let hydration: Promise<void> | null = null
function ensureHydrated(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      const saved = await idbGet<StoredChunk[]>(storeKey)
      if (saved && saved.length) chunks = saved
    })()
  }
  return hydration
}

function persist(): Promise<void> {
  return idbSet(storeKey, chunks)
}

// Découpage récursif simple (équivalent RecursiveCharacterTextSplitter : 1000/200).
// Renvoie chaque tranche avec son offset de départ dans le texte (slice contigu →
// offset déterministe, utilisé pour resurligner le segment dans la source).
function splitText(text: string, size = 1000, overlap = 200): { content: string; start: number }[] {
  if (text.length <= size) return [{ content: text, start: 0 }]
  const pieces: { content: string; start: number }[] = []
  let start = 0
  while (start < text.length) {
    pieces.push({ content: text.slice(start, start + size), start })
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
  await ensureHydrated()
  const pieces = docs.flatMap((doc) =>
    splitText(doc.pageContent).map((piece) => ({
      content: piece.content,
      metadata: { ...doc.metadata, offset: piece.start }
    }))
  )
  if (pieces.length === 0) return

  const embeddings = await embed(pieces.map((p) => p.content))

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
  await persist()
}

// Recherche par similarité cosinus, puis dédoublonnage par source pour proposer
// une complétion issue de sources distinctes (intention produit : « une complétion
// par source »).
export async function similaritySearch(query: string, k = 4): Promise<Doc[]> {
  await ensureHydrated()
  if (chunks.length === 0) return []

  const [embedding] = await embed([query])

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

// Identifiants de sources déjà vectorisées (pour la réconciliation au chargement).
export async function presentSourceIds(): Promise<Set<string>> {
  await ensureHydrated()
  return new Set(chunks.map((c) => c.doc.metadata.id))
}

// Retire les vecteurs d'une source supprimée.
export async function removeDocuments(sourceId: string): Promise<void> {
  await ensureHydrated()
  chunks = chunks.filter((c) => c.doc.metadata.id !== sourceId)
  await persist()
}

// Vide tout le store (reset).
export async function clearChunks(): Promise<void> {
  chunks = []
  await idbDel(storeKey)
}
