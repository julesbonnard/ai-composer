import { ref } from 'vue'
import { defineStore } from 'pinia'
import { addDocuments, presentSourceIds, removeDocuments, clearChunks } from '../plugins/ai'
import { idbGet, idbSet, SOURCES_KEY } from '../plugins/ai/persistence'
import { v4 as uuidv4 } from 'uuid'

interface DocMetadata {
  id: string
  title: string
}

interface Source extends DocMetadata {
  content: string
  embeddings: boolean
  active: boolean
}

export const useSourcesStore = defineStore('sources', () => {
  const sources = ref([] as Source[])

  // Sérialise la liste des sources dans IndexedDB (sans les réactifs Vue).
  function persist(): Promise<void> {
    return idbSet(SOURCES_KEY, JSON.parse(JSON.stringify(sources.value)) as Source[])
  }

  async function loadSources(): Promise<void> {
    const saved = await idbGet<Source[]>(SOURCES_KEY)
    if (saved) sources.value = saved

    // Réconciliation : les vecteurs sont persistés à part, par modèle d'embeddings.
    // Toute source absente du vector store (premier chargement, ou changement de
    // modèle → dimensions invalidées) est ré-embeddée.
    const present = await presentSourceIds()
    for (const source of sources.value) {
      if (present.has(source.id)) {
        source.embeddings = true
      } else {
        source.embeddings = false
        try {
          await generateVectors(source)
        } catch (err) {
          console.error(err)
        }
      }
    }
  }
  loadSources()

  async function generateVectors(source: Source) {
    await addDocuments([
      {
        id: source.id,
        pageContent: source.content,
        metadata: { title: source.title, id: source.id }
      }
    ])
    const storedSource = getSourceById(source.id)
    if (storedSource) storedSource.embeddings = true
  }

  async function addSource(content: string, title: string) {
    const id = uuidv4()
    const source = {
      id,
      title,
      content,
      embeddings: false,
      active: true
    }
    sources.value.push(source)
    try {
      await generateVectors(source)
      await persist()
    } catch (err) {
      console.error(err)
      await deleteSourceById(id)
    }

    return source
  }

  async function deleteSourceById(id: string) {
    sources.value = sources.value.filter((d) => d.id !== id)
    await removeDocuments(id)
    await persist()
  }

  function getSourceById(id: string) {
    return sources.value.find((d) => d.id === id)
  }

  async function toggleSourceActive(id: string) {
    const source = getSourceById(id)
    if (source) {
      source.active = !source.active
      await persist()
    }
  }

  async function $reset(): Promise<void> {
    sources.value = []
    await clearChunks()
    await persist()
  }

  return { sources, $reset, addSource, deleteSourceById, getSourceById, loadSources, toggleSourceActive }
})
