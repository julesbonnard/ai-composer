import type { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import workerUrl from './webLLM.worker?url';
import type { ChatMessage } from '@langchain/core/messages';

const worker = new Worker(new URL(workerUrl, import.meta.url), {
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

export function getLLM() {
  return {
    stream: async (messages: BaseLanguageModelInput) => {
      return runWorker(worker, {
        task: 'generate',
        messages
      })
    },
    invoke: async (messages: BaseLanguageModelInput): Promise<ChatMessage> => {
      return runWorker(worker, {
        task: 'generate',
        messages
      })
    }
  }
}

export function getEmbeddings() {
  return {
    embedDocuments (content: string[]): Promise<number[][]> {
      return runWorker(worker, {
        task: 'embed',
        content
      })
    },
    embedQuery (content: string): Promise<number[]> {
      return runWorker(worker, {
        task: 'embed',
        content
      })
    }
  }
}