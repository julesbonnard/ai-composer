import { create, insertMultiple, removeMultiple, search, save, load } from '@orama/orama'
import type { AnyOrama } from '@orama/orama'
import { embed } from './engine'
import { embeddingsSelection } from './selection'
import { idbGet, idbSet, idbDel, CHUNKS_KEY } from './persistence'
import { logRetrieval } from './debug'

// Document léger, structurellement compatible avec l'ancien Document LangChain
// (pageContent + metadata + id) consommé par Autocompletion.ts.
export interface Doc {
  id: string
  pageContent: string
  // offset = position du chunk (en caractères) dans le contenu de la source.
  metadata: { title: string; id: string; offset?: number }
}

// Recherche **hybride** (BM25 lexical + cosinus dense) via Orama, PERSISTÉE dans
// IndexedDB. L'hybride ajoute le rappel lexical (noms propres, chiffres, citations
// exactes) que le dense seul rate — décisif en journalisme. Les vecteurs sont ceux
// d'`engine.embed()` (« bring-your-own-vectors » : Orama ne calcule pas d'embeddings).
//
// La clé de persistance inclut le modèle d'embeddings : changer de modèle (dimensions
// différentes) repart d'un store vide → les sources sont ré-embeddées (cf. stores/sources.ts).
const storeKey = CHUNKS_KEY(embeddingsSelection.model)

// Les modèles E5 (p.ex. multilingual-e5-small, le défaut) sont entraînés avec des
// préfixes d'instruction OBLIGATOIRES : « query: » pour la requête, « passage: » pour
// les documents. Sans eux, la qualité de la recherche dense chute fortement. On préfixe
// UNIQUEMENT l'entrée d'embedding ; le texte indexé pour le BM25 (pageContent) et le
// terme de requête lexical restent BRUTS (sinon le préfixe pollue l'index lexical).
const isE5 = /e5/i.test(embeddingsSelection.model)
const asPassage = (t: string) => (isE5 ? `passage: ${t}` : t)
const asQuery = (t: string) => (isE5 ? `query: ${t}` : t)

// En-deçà de ce seuil, une source est considérée COURTE : un seul embedding (le texte
// entier), pas de chunking — cohérent avec « ne chunker que les sources longues ».
// Aussi borné par la fenêtre du modèle d'embeddings (≈512 tokens pour e5-small ≈ 2000 car.).
const SHORT_SOURCE_CHARS = 2000

// Schéma Orama : pageContent indexé pour le BM25, vecteur pour le dense, le reste en
// metadata. La dimension du vecteur dépend du modèle d'embeddings → connue seulement
// au premier embedding (ou rechargée depuis la persistance).
const schemaFor = (dim: number) =>
  ({
    pageContent: 'string',
    sourceId: 'string',
    title: 'string',
    offset: 'number',
    embedding: `vector[${dim}]`
  }) as const

// Tokenizer **neutre** (ni stemming ni stopwords) : les sources peuvent être
// multilingues (AFP), et la valeur du lexical ici est surtout le matching exact
// (noms, chiffres, acronymes), indépendant de la langue. Un stemmer mono-langue
// dégraderait les autres langues. À affiner par corpus si besoin.
const tokenizer = { stemming: false, stopWords: [] as string[] }

interface PersistShape {
  dim: number
  dump: unknown
  // sourceId → ids internes Orama des chunks (pour la suppression ciblée).
  sourceToIds: Record<string, string[]>
}

let dim = 0
let sourceToIds: Record<string, string[]> = {}

// Création/hydratation paresseuse (une seule fois). Résout `null` tant qu'aucun
// vecteur n'a été stocké (dimension inconnue → pas encore de base Orama).
let dbPromise: Promise<AnyOrama | null> | null = null

async function hydrate(): Promise<AnyOrama | null> {
  const saved = await idbGet<PersistShape>(storeKey)
  if (saved?.dim) {
    dim = saved.dim
    sourceToIds = saved.sourceToIds ?? {}
    const db = await create({ schema: schemaFor(dim), components: { tokenizer } })
    await load(db, saved.dump as Parameters<typeof load>[1])
    return db
  }
  return null
}

function getStore(): Promise<AnyOrama | null> {
  if (!dbPromise) dbPromise = hydrate()
  return dbPromise
}

async function persist(db: AnyOrama): Promise<void> {
  const dump = await save(db)
  await idbSet(storeKey, { dim, dump, sourceToIds } satisfies PersistShape)
}

// Découpage **paragraphe par paragraphe** : chaque paragraphe (séparé par un ou
// plusieurs sauts de ligne, cf. SourceEditor) devient un chunk, avec son offset de
// départ dans le texte d'origine (utilisé pour resurligner le segment dans la source).
// Repli : un paragraphe anormalement long (> maxSize, dépasserait la fenêtre du modèle
// d'embeddings) est re-découpé en fenêtres glissantes (maxSize/overlap).
function splitText(
  text: string,
  maxSize = 2000,
  overlap = 200
): { content: string; start: number }[] {
  // Source courte → un seul chunk (un seul embedding), pas de découpage.
  if (text.length <= SHORT_SOURCE_CHARS) return [{ content: text, start: 0 }]

  const pieces: { content: string; start: number }[] = []
  let cursor = 0
  while (cursor < text.length) {
    const nl = text.indexOf('\n', cursor)
    const end = nl === -1 ? text.length : nl
    const paragraph = text.slice(cursor, end)
    if (paragraph.trim() !== '') {
      if (paragraph.length > maxSize) {
        // Paragraphe trop long → fenêtres glissantes, offsets relatifs au paragraphe.
        for (let s = 0; s < paragraph.length; s += maxSize - overlap) {
          pieces.push({ content: paragraph.slice(s, s + maxSize), start: cursor + s })
        }
      } else {
        pieces.push({ content: paragraph, start: cursor })
      }
    }
    // Avance après le(s) saut(s) de ligne (offsets cohérents avec offsetToPos).
    cursor = end + 1
    while (cursor < text.length && text[cursor] === '\n') cursor++
  }
  return pieces.length > 0 ? pieces : [{ content: text, start: 0 }]
}

export async function addDocuments(docs: Doc[]): Promise<void> {
  const pieces = docs.flatMap((doc) =>
    splitText(doc.pageContent).map((piece) => ({
      content: piece.content,
      title: doc.metadata.title,
      sourceId: doc.metadata.id,
      offset: piece.start
    }))
  )
  if (pieces.length === 0) return

  // Embedding préfixé E5 ; le texte indexé (pageContent) reste brut.
  const embeddings = await embed(pieces.map((p) => asPassage(p.content)))

  // Première insertion de la session : la dimension fixe le schéma Orama.
  let db = await getStore()
  if (!db) {
    dim = embeddings[0].length
    db = await create({ schema: schemaFor(dim), components: { tokenizer } })
    dbPromise = Promise.resolve(db)
  }

  const ids = await insertMultiple(
    db,
    pieces.map((p, i) => ({
      pageContent: p.content,
      sourceId: p.sourceId,
      title: p.title,
      offset: p.offset,
      embedding: embeddings[i]
    }))
  )

  // Trace les ids par source pour la suppression ciblée.
  pieces.forEach((p, i) => {
    ;(sourceToIds[p.sourceId] ??= []).push(ids[i])
  })
  await persist(db)
}

interface StoredDoc {
  pageContent: string
  sourceId: string
  title: string
  offset: number
}

// Recherche hybride brute, partagée par rankSources / buildSourceContext.
async function hybridHits(query: string, limit: number) {
  const db = await getStore()
  if (!db) return []
  const [embedding] = await embed([asQuery(query)])
  const res = await search(db, {
    mode: 'hybrid',
    term: query, // BM25 : terme brut (pas de préfixe E5)
    vector: { value: embedding, property: 'embedding' },
    similarity: 0,
    limit
  })
  return res.hits.map((h) => ({ doc: h.document as unknown as StoredDoc, score: h.score }))
}

export interface RankedSource {
  sourceId: string
  title: string
  score: number
}

// Classe les SOURCES (et non les chunks) par pertinence : score d'une source = score
// MAX de ses chunks (signal robuste, bien plus fiable que choisir le bon paragraphe).
// `activeIds` restreint aux sources cochées (filtrage à la requête, pas de réembedding).
export async function rankSources(
  query: string,
  activeIds?: string[],
  limit = 6
): Promise<RankedSource[]> {
  const hits = await hybridHits(query, 400)
  const activeSet = activeIds ? new Set(activeIds) : null

  // Meilleur chunk par source.
  const best = new Map<string, { score: number; title: string; text: string }>()
  for (const { doc, score } of hits) {
    if (activeSet && !activeSet.has(doc.sourceId)) continue
    const cur = best.get(doc.sourceId)
    if (!cur || score > cur.score) {
      best.set(doc.sourceId, { score, title: doc.title, text: doc.pageContent })
    }
  }

  const ranked = [...best.entries()]
    .map(([sourceId, v]) => ({ sourceId, title: v.title, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  logRetrieval(
    query,
    ranked.map((r) => ({ source: r.title, score: r.score, text: best.get(r.sourceId)!.text }))
  )
  return ranked
}

// Contexte à envoyer au LLM pour une source : son contenu ENTIER s'il tient dans le
// budget (cas nominal — le modèle voit tout, zéro erreur intra-source) ; sinon repli
// sur ses meilleurs chunks pour cette requête (retrieval intra-source).
export async function buildSourceContext(
  query: string,
  sourceId: string,
  wholeContent: string,
  budgetChars = 6000
): Promise<string> {
  if (wholeContent.length <= budgetChars) return wholeContent

  const hits = await hybridHits(query, 400)
  const acc: string[] = []
  let len = 0
  for (const { doc } of hits) {
    if (doc.sourceId !== sourceId) continue
    if (len + doc.pageContent.length > budgetChars) break
    acc.push(doc.pageContent)
    len += doc.pageContent.length
  }
  return acc.length ? acc.join('\n\n') : wholeContent.slice(0, budgetChars)
}

// Identifiants de sources déjà vectorisées (pour la réconciliation au chargement).
export async function presentSourceIds(): Promise<Set<string>> {
  await getStore()
  return new Set(Object.keys(sourceToIds))
}

// Retire les vecteurs d'une source supprimée.
export async function removeDocuments(sourceId: string): Promise<void> {
  const db = await getStore()
  const ids = sourceToIds[sourceId]
  if (!db || !ids?.length) {
    delete sourceToIds[sourceId]
    return
  }
  await removeMultiple(db, ids)
  delete sourceToIds[sourceId]
  await persist(db)
}

// Vide tout le store (reset).
export async function clearChunks(): Promise<void> {
  await idbDel(storeKey)
  sourceToIds = {}
  dim = 0
  dbPromise = Promise.resolve(null)
}
