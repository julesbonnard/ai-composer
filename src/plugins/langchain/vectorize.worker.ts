import { pipeline } from '@huggingface/transformers'

self.onmessage = async (event: MessageEvent) => {
  const { model, dtype, content } = event.data;
  
  const extractor = await pipeline('feature-extraction', model, { device: "auto", dtype })
  const embeddings = await extractor(content, {
    pooling: 'mean',
    normalize: true
  })

  self.postMessage(embeddings.tolist());
};

export default {} as Worker;