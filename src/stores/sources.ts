import { ref } from 'vue'
import { defineStore } from 'pinia'
import { addDocuments, similaritySearch } from '@/plugins/langchain'
import { Document } from '@langchain/core/documents'
import { v4 as uuidv4 } from 'uuid'
// import { VectorStorage, type IVSDocument } from "@/plugins/VectorStorage"

// const vectorStore = new VectorStorage()

interface DocMetadata {
  title: string
}

interface Source extends DocMetadata {
  id: string
  content: string
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

  async function addSource(content: string, title: string) {
    // const doc = await vectorStore.addText(content, { title: title })
    // await loadSources()
    // return doc
    const id = uuidv4()
    await addDocuments([
      new Document({ id: uuidv4(), pageContent: content, metadata: { title: title } })
    ])
    return { id }
  }

  async function deleteSourceById(id: string) {
    // await vectorStore.deleteDocumentById(id)
    // await loadSources()
  }

  function getSourceById(id: string) {
    return sources.value.find((d) => d.id === id)
  }

  async function $reset(): Promise<void> {
    // await vectorStore.reset()
    // await loadSources()
  }

  return { sources, $reset, addSource, deleteSourceById, getSourceById, loadSources }
})
