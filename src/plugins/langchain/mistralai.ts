import { MistralAIEmbeddings } from "@langchain/mistralai";
import { MistralCore } from "@mistralai/mistralai/core.js";
import { chatComplete } from "@mistralai/mistralai/funcs/chatComplete.js";
import { chatStream } from "@mistralai/mistralai/funcs/chatStream.js";
import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

export function getEmbeddings(model: string) {
  return new MistralAIEmbeddings({
    apiKey: import.meta.env.VITE_MISTRALAI_APIKEY,
    model
  });
}

interface MistralAiChatModelInput extends BaseChatModelParams {
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
}

class MistralAiChatModel extends SimpleChatModel {
  client: MistralCore;
  model: string;

  constructor(fields: MistralAiChatModelInput) {
    super(fields);
    this.model = fields.model;
    this.client = new MistralCore({ apiKey: import.meta.env.VITE_MISTRALAI_APIKEY, ...fields })
  }

  _llmType() {
    return "mistralai";
  }

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (!messages.length) {
      throw new Error("No messages provided.");
    }
    // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
    // await subRunnable.invoke(params, runManager?.getChild());
    const res = await chatComplete(this.client, {
      model: this.model,
      messages: messages.map(message => {
        const type = message.getType();
        const role = type === "ai" ? "assistant" : type === "system" ? "system" : "user";
        const content = message.content as string;
        return {
          role,
          content,
          prefix: role === "assistant" && message.lc_kwargs.prefix === true
        }
      }),
      ...options
    })
    if (!res.ok) {
      throw res.error;
    }
    const { value: result } = res;

    return result.choices?.[0]?.message?.content as string;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (!messages.length) {
      throw new Error("No messages provided.");
    }
    if (typeof messages[0].content !== "string") {
      throw new Error("Multimodal messages are not supported.");
    }
    // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
    // await subRunnable.invoke(params, runManager?.getChild());
    const res = await chatStream(this.client, {
      model: this.model,
      messages: messages.map(message => {
        const type = message.getType();
        const role = type === "ai" ? "assistant" : type === "system" ? "system" : "user";
        const content = message.content as string;
        return {
          role,
          content,
          prefix: role === "assistant" && message.lc_kwargs.prefix === true
        }
      }),
      ...options
    })

    if (!res.ok) {
      throw res.error;
    }

    const { value: result } = res;

    for await (const event of result) {
      const content = event.data.choices[0].delta.content as string
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content,
        }),
        text: content,
      });
      // Trigger the appropriate callback for new chunks
      await runManager?.handleLLMNewToken(content);
    }
  }
}

export function getLLM(model: string, options?: any) {
  const defaultOptions = {
    temperature: 0.3,
    maxTokens: undefined,
    timeout: undefined,
    maxRetries: 2,
  }
  return new MistralAiChatModel({
    apiKey: import.meta.env.VITE_MISTRALAI_APIKEY,
    model,
    ...defaultOptions,
    ...options
  })
}
