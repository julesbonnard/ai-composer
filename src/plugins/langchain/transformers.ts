import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import VectorizeWorker from './vectorize.worker?worker';
import GenerateWorker from './generate.worker?worker';

type Dtype = "auto" | "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16" | Record<string, "auto" | "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16"> | undefined

function runWorker<TInput, TOutput>(WorkerClass: new () => Worker, input: TInput): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const worker = new WorkerClass();

    worker.postMessage(input);

    worker.onmessage = (event: MessageEvent<TOutput>) => {
      resolve(event.data);
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
  });
}

export function getEmbeddings(model?: string, dtype?: Dtype) {
  return {
    embedDocuments (content: string[]) {
      return runWorker(VectorizeWorker, {
        model, dtype, content
      })
    },
    embedQuery (content: string) {
      return runWorker(VectorizeWorker, {
        model, dtype, content
      })
    }
  }
}

export function getLLM(model?: string, dtype?: Dtype) {
  return {
    stream: async (messages: BaseLanguageModelInput) => {
      return runWorker(GenerateWorker, {
        model, dtype, messages
      })
    },
    invoke: async (messages: BaseLanguageModelInput) => {
      return runWorker(GenerateWorker, {
        model, dtype, messages
      })
    }
  }
}
