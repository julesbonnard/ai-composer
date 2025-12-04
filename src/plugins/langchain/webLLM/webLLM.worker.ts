// Must be run in a web environment, e.g. a web worker

import { ChatMessage } from "@langchain/core/messages";

import { ChatWebLLM } from "@langchain/community/chat_models/webllm";
import { WebLLMEmbeddings } from "./WebLLMEmbeddings";
import { type BaseLanguageModelInput } from '@langchain/core/language_models/base'

// Initialize the ChatWebLLM model with the model record and chat options.
// Note that if the appConfig field is set, the list of model records
// must include the selected model record for the engine.

// You can import a list of models available by default here:
// https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
//
// Or by importing it via:
// import { prebuiltAppConfig } from "@mlc-ai/web-llm";

const chatModel = new ChatWebLLM({
  model: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  chatOptions: {
    temperature: 0.5,
  },
});

let chatModelInitialized = false;

async function handleGenerate(event: MessageEvent): Promise<ChatMessage> {
  if (!chatModelInitialized) {
    await chatModel.initialize(progress => {
      console.log(progress);
    });
    chatModelInitialized = true;
  }

  const messages = event.data.messages as BaseLanguageModelInput;

  const response = await chatModel.invoke(messages);

  return  new ChatMessage({ content: response.content, role: 'assistant' })
}

const embedModel = new WebLLMEmbeddings("snowflake-arctic-embed-m-q0f32-MLC-b4");
let embedModelInitialized = false;

async function handleEmbed(event: MessageEvent): Promise<number[][]> {
  if (!embedModelInitialized) {
    await embedModel.initialize(progress => {
      console.log(progress);
    });
    embedModelInitialized = true;
  }
  
  const content: string[] = event.data.content;
  return embedModel.embedDocuments(content);
}

self.onmessage = async (event: MessageEvent) => {
  const { task } = event.data;
  if (task === "generate") {
    self.postMessage(await handleGenerate(event));
  } else if (task === 'embed') {
    self.postMessage(await handleEmbed(event));
  } else {
    throw 'Unknown task';
  }
};

export default {} as Worker;