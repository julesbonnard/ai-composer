import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

function splitDocuments(documents: Document[]) {
  return textSplitter.splitDocuments(documents);
}

export function getVectorStore(embeddings: EmbeddingsInterface) {
  const vectorStore = new MemoryVectorStore(embeddings);

  const mmrRetriever = vectorStore.asRetriever({
    searchType: "mmr",
    searchKwargs: {
      fetchK: 10,
    },
    k: 4,
  });

  return {
    addDocuments: async (
      documents: Document[],
    ): Promise<[vectors: number[][], documents: Document[]]> => {
      const chunks = await splitDocuments(documents);
      const vectors = await embeddings.embedDocuments(
        chunks.map((chunk) => chunk.pageContent),
      );
      await vectorStore.addVectors(vectors, chunks);
      return [vectors, chunks];
    },
    addVectors: vectorStore.addVectors,
    similaritySearch: (query: string) => mmrRetriever.invoke(query) as Promise<Document[]>
  };
}
