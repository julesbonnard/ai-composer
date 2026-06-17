import { pipeline, TextStreamer, env, type PreTrainedModel, AutoProcessor, type ProgressCallback, AutoModelForImageTextToText, RawImage } from "@huggingface/transformers";
import { ChatMessage } from "@langchain/core/messages";

const DEVICE = 'webgpu';
const MODEL_ID = 'mistralai/Ministral-3-3B-Instruct-2512-ONNX';

// --- State ---
let model: PreTrainedModel | null;
let processor: any | null;

// --- Public API ---
/**
 * Loads the model and processor, and sets up the environment.
 * @param {function(object): void} progressCallback - A function to call with progress updates.
 */

export async function loadModel(progressCallback: ProgressCallback): Promise<void> {
  env.allowLocalModels = false;

  // The wasm files are bundled with the library, but we need to specify the path
  // to them when using a CDN.
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  }
  
  // Set device
  env.backends.onnx.device = DEVICE;

  try {
    console.log('Loading model...');
    model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
      device: DEVICE,
    });
    console.log('Model loaded.');

    console.log('Loading processor...');
    processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
    });
    console.log('Processor loaded.');

  } catch (error) {
    console.error('Error loading model:', error);
    throw error; // Propagate the error to the caller
  }
}

/**
 * Runs inference with the loaded model.
 * @param {string} inputText - The user's input text.
 * @param {function(string): void} streamCallback - A function to call with each generated token.
 */
export async function runInference(inputText: string, streamCallback: (text: string) => void): Promise<void> {
    if (!model || !processor) {
        throw new Error('Model not loaded. Please call loadModel() first.');
    }

    const messages = [
        {
            role: 'user',
            content: [
                { type: 'image' },
                { type: 'text', text: inputText }
            ],
        },
    ];
    const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });

    // Create a 1x1 black RawImage
    const blackPixel = new Uint8ClampedArray([0, 0, 0, 255]); // RGBA
    const dummyImage = new RawImage(blackPixel, 1, 1, 4);

    // Pass the dummy image to the processor
    const inputs = await processor(dummyImage, prompt);

    let fullOutput = '';
    const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
            fullOutput += text;
            streamCallback(fullOutput);
        },
    });

    await model.generate({
        ...inputs,
        max_new_tokens: 512,
        streamer: streamer,
        do_sample: true,
        temperature: 0.7,
        top_p: 0.95,
        top_k: 50,
        eos_token_id: processor.tokenizer.eos_token_id,
        pad_token_id: processor.tokenizer.pad_token_id,
    });
}

async function handleGenerate(event: MessageEvent): Promise<ChatMessage> {
  const { messages } = event.data;

  await loadModel(console.log);

  if (!model || !processor) {
      throw new Error('Model not loaded. Please call loadModel() first.');
  }

  let answer = '';

  await runInference(messages[messages.length - 1].content.text, (text) => {
    answer += text;
  });

  return new ChatMessage({ content: answer, role: 'assistant' });
}


// async function handleGenerate(event: MessageEvent): Promise<ChatMessage> {
//   const {
//     model = "onnx-community/Qwen2.5-0.5B-Instruct",
//     dtype = "q4",
//     messages,
//   }: {
//     model: string;
//     dtype: Dtype;
//     messages: string | string[] | Chat | Chat[];
//   } = event.data;

//   const generator = await pipeline("text-generation", model, {
//     device: "auto",
//     dtype,
//   });
//   const streamer = new TextStreamer(generator.tokenizer, {
//     skip_prompt: true,
//   });
//   const output = await generator(messages, {
//     max_new_tokens: 512,
//     do_sample: false,
//     streamer,
//   });
//   if (output.length == 0 || !output[0]) throw new Error("No output from model");
//   const firstOutput = output[0]
  
//   if ('generated_text' in firstOutput === false) {
//     return new ChatMessage({ content: JSON.stringify(firstOutput), role: 'assistant' });
//   }
//   if (typeof firstOutput.generated_text !== 'string') {
//     return new ChatMessage({ content: firstOutput.generated_text.toString(), role: 'assistant' });
//   }
//   return new ChatMessage({ content: firstOutput.generated_text, role: 'assistant' });
// }

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
