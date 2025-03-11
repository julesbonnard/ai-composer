import { ref } from 'vue'
import { defineStore } from 'pinia'
import { VectorStorage, type IVSDocument } from "@/plugins/VectorStorage"

const vectorStore = new VectorStorage()

interface DocMetadata {
  title: string
}

interface Source extends DocMetadata {
  id: string
  content: string
}

export const useSourcesStore = defineStore('sources', () => {
  const sources = ref([] as Source[])

  async function loadSources (): Promise<void> {
    const documents = await vectorStore.getDocuments() as IVSDocument<DocMetadata>[]
    if (documents) {
      sources.value = documents.map(d => ({
        id: d.id,
        title: d.metadata.title,
        content: d.text
      }))
    }
  }
  loadSources()

  async function addSource (content: string, title: string) {
    const doc = await vectorStore.addText(content, { title: title })
    await loadSources()
    return doc
  }

  async function search (query: string) {
    return await vectorStore.similaritySearch({
      query
    })
  }

  async function deleteSourceById (id: string) {
    await vectorStore.deleteDocumentById(id)
    await loadSources()
  }

  function getSourceById (id: string) {
    return sources.value.find(d => d.id === id)
  }

  async function $reset(): Promise<void> {
    await vectorStore.reset()
    await loadSources()
  }

  return { sources, $reset, addSource, deleteSourceById, getSourceById, search, loadSources }
})

