import { type Chat, pipeline, TextStreamer } from "@huggingface/transformers";
import { ChatMessage } from "@langchain/core/messages";

async function handleGenerate(event: MessageEvent): Promise<ChatMessage> {
  const {
    model = "onnx-community/Qwen2.5-0.5B-Instruct",
    dtype = "q4",
    messages,
  }: {
    model: string;
    dtype: Dtype;
    messages: string | string[] | Chat | Chat[];
  } = event.data;

  const generator = await pipeline("text-generation", model, {
    device: "auto",
    dtype,
  });
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
  });
  const output = await generator(messages, {
    max_new_tokens: 512,
    do_sample: false,
    streamer,
  });
  if (output.length == 0 || !output[0]) throw new Error("No output from model");
  const firstOutput = output[0]
  
  if ('generated_text' in firstOutput === false) {
    return new ChatMessage({ content: JSON.stringify(firstOutput), role: 'assistant' });
  }
  if (typeof firstOutput.generated_text !== 'string') {
    return new ChatMessage({ content: firstOutput.generated_text.toString(), role: 'assistant' });
  }
  return new ChatMessage({ content: firstOutput.generated_text, role: 'assistant' });
}

async function handleEmbed(event: MessageEvent) {
  const { model, dtype, content } = event.data;
  
  const extractor = await pipeline('feature-extraction', model, { device: "auto", dtype })
  const embeddings = await extractor(content, {
    pooling: 'mean',
    normalize: true
  })

  return embeddings.tolist();
}



self.onmessage = async (event: MessageEvent) => {
  const { task } = event.data;

  if (task === "generate") {
    self.postMessage(await handleGenerate(event));
  } else if (task === "embed") {
    self.postMessage(await handleEmbed(event));
  } else {
    throw 'Unknown task';
  }
};

export default {} as Worker;
