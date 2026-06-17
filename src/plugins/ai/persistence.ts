import { openDB, type IDBPDatabase } from 'idb'

// Persistance navigateur (IndexedDB) pour les vecteurs et la liste des sources.
// Un seul object store clé→valeur (`kv`) suffit : les vecteurs sont rangés sous
// `chunks:<modèle d'embeddings>` (invalidation automatique au changement de modèle —
// les dimensions diffèrent), la liste des sources sous `sources`.

const DB_NAME = 'ai-composer'
const STORE = 'kv'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
    })
  }
  return dbPromise
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return (await getDB()).get(STORE, key) as Promise<T | undefined>
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await (await getDB()).put(STORE, value, key)
}

export async function idbDel(key: string): Promise<void> {
  await (await getDB()).delete(STORE, key)
}

export const CHUNKS_KEY = (model: string) => `chunks:${model}`
export const SOURCES_KEY = 'sources'
