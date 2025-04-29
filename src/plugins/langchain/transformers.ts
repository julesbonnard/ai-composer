// import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers'
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'

export function getEmbeddings(model: string) {
  return new HuggingFaceTransformersEmbeddings({
    model
  })
}

export function getLLM(model: string, options?: any) {
  return {
    stream: async (messages: BaseLanguageModelInput, options?: any) => {
      throw new Error('Not implemented')
    },
    invoke: async (messages: BaseLanguageModelInput, options?: any) => {
      throw new Error('Not implemented')
    }
  }
}
