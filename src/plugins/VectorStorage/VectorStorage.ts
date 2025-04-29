import { type IDBPDatabase, openDB } from 'idb'
import { type IVSDocument, type IVSSimilaritySearchItem } from './types/IVSDocument'
import { type IVSOptions } from './types/IVSOptions'
import { type IVSSimilaritySearchParams } from './types/IVSSimilaritySearchParams'
import { constants } from './common/constants'
import { filterDocuments, getObjectSizeInMB } from './common/helpers'
import { vectorize } from '../transformers'
import { v4 as uuidv4 } from 'uuid'

export class VectorStorage<T> {
  private db!: IDBPDatabase<any>
  private documents: Array<IVSDocument<T>> = []
  private readonly maxSizeInMB: number
  private readonly embedTextsFn: (texts: string[]) => Promise<number[][]>

  constructor(options: IVSOptions = {}) {
    this.maxSizeInMB = options.maxSizeInMB ?? constants.DEFAULT_MAX_SIZE_IN_MB
    this.embedTextsFn = this.embedTexts
    this.loadFromIndexDbStorage()
  }

  public async addText(text: string, metadata: T): Promise<IVSDocument<T>> {
    // Create a document from the text and metadata
    const doc: IVSDocument<T> = {
      id: uuidv4(),
      metadata,
      text,
      timestamp: Date.now(),
      vector: [],
      vectorMag: 0
    }
    const docs = await this.addDocuments([doc])
    return docs[0]
  }

  public async similaritySearch(params: IVSSimilaritySearchParams): Promise<{
    similarItems: Array<IVSSimilaritySearchItem<T>>
    query: { text: string; embedding: number[] }
  }> {
    const { query, k = 4, filterOptions, includeValues } = params
    const queryEmbedding = await this.embedText(query)
    const queryMagnitude = await this.calculateMagnitude(queryEmbedding)
    const filteredDocuments = filterDocuments(this.documents, filterOptions)
    const scoresPairs: Array<[IVSDocument<T>, number]> = this.calculateSimilarityScores(
      filteredDocuments,
      queryEmbedding,
      queryMagnitude
    )
    const sortedPairs = scoresPairs.sort((a, b) => b[1] - a[1])
    const results = sortedPairs.slice(0, k).map((pair) => ({ ...pair[0], score: pair[1] }))
    this.updateHitCounters(results)
    if (results.length > 0) {
      this.removeDocsLRU()
      await this.saveToIndexDbStorage()
    }
    if (!includeValues) {
      results.forEach((result) => {
        delete result.vector
        delete result.vectorMag
      })
    }
    return {
      query: { embedding: queryEmbedding, text: query },
      similarItems: results
    }
  }

  public async getDocuments(): Promise<IVSDocument<T>[]> {
    if (this.documents.length == 0) {
      await this.loadFromIndexDbStorage()
    }
    return this.documents
  }

  public async deleteDocumentById(id: string) {
    this.documents = this.documents.filter((d) => d.id !== id)
    await this.saveToIndexDbStorage()
  }

  public async reset() {
    this.documents = []
    await this.saveToIndexDbStorage()
  }

  private async initDB(): Promise<IDBPDatabase<any>> {
    return await openDB<any>('VectorStorageDatabase', undefined, {
      upgrade(db) {
        const documentStore = db.createObjectStore('documents', {
          autoIncrement: false,
          keyPath: 'id'
        })
        documentStore.createIndex('text', 'text', { unique: true })
        documentStore.createIndex('metadata', 'metadata')
        documentStore.createIndex('timestamp', 'timestamp')
        documentStore.createIndex('vector', 'vector')
        documentStore.createIndex('vectorMag', 'vectorMag')
        documentStore.createIndex('hits', 'hits')
      }
    })
  }

  private async addDocuments(documents: Array<IVSDocument<T>>): Promise<Array<IVSDocument<T>>> {
    const newVectors = await this.embedTextsFn(documents.map((doc) => doc.text))
    // Assign vectors and precompute vector magnitudes for new documents
    documents.forEach((doc, index) => {
      doc.vector = newVectors[index]
      doc.vectorMag = calcVectorMagnitude(doc)
    })
    // Add new documents to the store
    this.documents.push(...documents)
    this.removeDocsLRU()
    // Save to index db storage
    await this.saveToIndexDbStorage()
    return documents
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((d) => vectorize(d)))
  }

  private async embedText(query: string): Promise<number[]> {
    return (await this.embedTextsFn([query]))[0]
  }

  private calculateMagnitude(embedding: number[]): number {
    const queryMagnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return queryMagnitude
  }

  private calculateSimilarityScores(
    filteredDocuments: Array<IVSDocument<T>>,
    queryVector: number[],
    queryMagnitude: number
  ): Array<[IVSDocument<T>, number]> {
    return filteredDocuments.map((doc) => {
      const dotProduct = doc.vector!.reduce((sum, val, i) => sum + val * queryVector[i], 0)
      let score = getCosineSimilarityScore(dotProduct, doc.vectorMag!, queryMagnitude)
      score = normalizeScore(score) // Normalize the score
      return [doc, score]
    })
  }

  private updateHitCounters(results: Array<IVSDocument<T>>): void {
    results.forEach((doc) => {
      doc.hits = (doc.hits ?? 0) + 1 // Update hit counter
    })
  }

  private async loadFromIndexDbStorage(): Promise<void> {
    if (!this.db) {
      this.db = await this.initDB()
    }
    this.documents = await this.db.getAll('documents')
    this.removeDocsLRU()
  }

  private async saveToIndexDbStorage(): Promise<void> {
    if (!this.db) {
      this.db = await this.initDB()
    }
    try {
      const tx = this.db.transaction('documents', 'readwrite')
      await tx.objectStore('documents').clear()
      for (const doc of this.documents) {
        // eslint-disable-next-line no-await-in-loop
        await tx.objectStore('documents').put(doc)
      }
      await tx.done
    } catch (error: any) {
      console.error('Failed to save to IndexedDB:', error.message)
    }
  }

  private removeDocsLRU(): void {
    if (getObjectSizeInMB(this.documents) > this.maxSizeInMB) {
      // Sort documents by hit counter (ascending) and then by timestamp (ascending)
      this.documents.sort((a, b) => (a.hits ?? 0) - (b.hits ?? 0) || a.timestamp - b.timestamp)

      // Remove documents until the size is below the limit
      while (getObjectSizeInMB(this.documents) > this.maxSizeInMB) {
        this.documents.shift()
      }
    }
  }
}

function calcVectorMagnitude(doc: IVSDocument<any>): number {
  return Math.sqrt(doc.vector!.reduce((sum, val) => sum + val * val, 0))
}

function getCosineSimilarityScore(
  dotProduct: number,
  magnitudeA: number,
  magnitudeB: number
): number {
  return dotProduct / (magnitudeA * magnitudeB)
}

function normalizeScore(score: number): number {
  return (score + 1) / 2
}
