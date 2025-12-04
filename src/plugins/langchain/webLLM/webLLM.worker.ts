// Must be run in a web environment, e.g. a web worker

import { ChatMessage } from "@langchain/core/messages";

import { ChatWebLLM } from "@langchain/community/chat_models/webllm";
// import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { type BaseLanguageModelInput } from '@langchain/core/language_models/base'

// Initialize the ChatWebLLM model with the model record and chat options.
// Note that if the appConfig field is set, the list of model records
// must include the selected model record for the engine.

// You can import a list of models available by default here:
// https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
//
// Or by importing it via:
// import { prebuiltAppConfig } from "@mlc-ai/web-llm";

const model = new ChatWebLLM({
  model: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  chatOptions: {
    temperature: 0.5,
  },
});

let modelInitialized = false;

async function handleGenerate(event: MessageEvent): Promise<ChatMessage> {
  if (!modelInitialized) {
    await model.initialize(progress => {
      console.log(progress);
    });
    modelInitialized = true;
  }

  const messages = event.data.messages as BaseLanguageModelInput;

  const response = await model.invoke(messages);

  return  new ChatMessage({ content: response.content, role: 'assistant' })
}

self.onmessage = async (event: MessageEvent) => {
  const { task } = event.data;
  if (task === "generate") {
    self.postMessage(await handleGenerate(event));
  } else {
    throw 'Unknown task';
  }
};

export default {} as Worker;