import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { CreateMLCEngine, type InitProgressCallback, type MLCEngineInterface } from "@mlc-ai/web-llm";

// For integration with Langchain
// From https://github.com/mlc-ai/web-llm/blob/main/examples/embeddings/src/embeddings.ts

export class WebLLMEmbeddings implements EmbeddingsInterface {
  modelId: string;
  engine: MLCEngineInterface | undefined;
  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async initialize (progressCallback: InitProgressCallback) {
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: progressCallback
    });
  }

  async _embed(texts: string[]): Promise<number[][]> {
    if (!this.engine) {
      throw new Error("Engine not initialized");
    }
    const reply = await this.engine.embeddings.create({
      input: texts
    });
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const embedding = reply.data[i]?.embedding;
      if (embedding) {
        result.push(embedding);
      }
    }
    return result;
  }

  async embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0] || []);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}