import { ref } from 'vue'
import { defineStore } from 'pinia'
import { addDocuments } from '../plugins/ai'
import { v4 as uuidv4 } from 'uuid'
// import { VectorStorage, type IVSDocument } from "@/plugins/VectorStorage"

// const vectorStore = new VectorStorage()

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

  async function loadSources(): Promise<void> {
    // const documents = await vectorStore.getDocuments() as IVSDocument<DocMetadata>[]
    // if (documents) {
    //   sources.value = documents.map(d => ({
    //     id: d.id,
    //     title: d.metadata.title,
    //     content: d.text
    //   }))
    // }
  }
  loadSources()

  async function generateVectors (source: Source) {
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
      generateVectors(source)
    } catch (err) {
      console.error(err)
      deleteSourceById(id)
    }
    
    return source
  }

  function deleteSourceById(id: string) {
    sources.value = sources.value.filter(d => d.id !== id)
    // await vectorStore.deleteDocumentById(id)
    // await loadSources()
  }

  function getSourceById(id: string) {
    return sources.value.find((d) => d.id === id)
  }

  function toggleSourceActive(id: string) {
    const source = getSourceById(id)
    if (source) {
      source.active = !source.active
    }
  }

  async function $reset(): Promise<void> {
    // await vectorStore.reset()
    // await loadSources()
  }

  return { sources, $reset, addSource, deleteSourceById, getSourceById, loadSources, toggleSourceActive }
})
