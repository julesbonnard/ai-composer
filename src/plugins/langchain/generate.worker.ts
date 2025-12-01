import { type Chat, pipeline, TextStreamer } from '@huggingface/transformers'

type Dtype = "auto" | "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16" | Record<string, "auto" | "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16"> | undefined

self.onmessage = async (event: MessageEvent) => {
  const { model = 'onnx-community/Qwen2.5-0.5B-Instruct', dtype = 'q4', messages }: { model: string, dtype: Dtype, messages: string | string[] | Chat | Chat[]} = event.data;
  
  const generator = await pipeline('text-generation', model, { device: "auto", dtype })
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true
  })
  const output = await generator(messages, { max_new_tokens: 512, do_sample: false, streamer })
  self.postMessage(output[0].generated_text.pop())
};

export default {} as Worker;