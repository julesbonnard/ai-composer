import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import workerUrk from './transformers.worker?url';
import type { ChatMessage } from '@langchain/core/messages';

const worker = new Worker(new URL(workerUrk, import.meta.url), {
  type: 'module',
})

function runWorker<TInput, TOutput>(worker: Worker, input: TInput): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    worker.postMessage(input);

    worker.onmessage = (event: MessageEvent<TOutput>) => {
      resolve(event.data);
      // worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
  });
}

export function getEmbeddings(model?: string, dtype?: Dtype) {
  return {
    embedDocuments (content: string[]): Promise<number[][]> {
      return runWorker(worker, {
        task: 'embed',
        model, dtype, content
      })
    },
    embedQuery (content: string): Promise<number[]> {
      return runWorker(worker, {
        task: 'embed',
        model, dtype, content
      })
    }
  }
}

export function getLLM(model?: string, dtype?: Dtype) {
  return {
    stream: async (messages: BaseLanguageModelInput) => {
      return runWorker(worker, {
        task: 'generate',
        model, dtype, messages
      })
    },
    invoke: async (messages: BaseLanguageModelInput): Promise<ChatMessage> => {
      return runWorker(worker, {
        task: 'generate',
        model, dtype, messages
      })
    }
  }
}
