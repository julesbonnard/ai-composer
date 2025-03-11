import type { pipeline } from '@xenova/transformers'

let pipe: typeof pipeline | undefined

async function initTransformers() {
  if (pipe) return
  const { pipeline, env } = await import('@xenova/transformers');
  (env as any).allowLocalModels = false
  pipe = pipeline
}

export async function vectorize (content: string) {
  await initTransformers()
  const generateEmbedding = await pipe!('feature-extraction', 'Supabase/gte-small')
  const output = await generateEmbedding(content, {
    pooling: 'mean',
    normalize: true,
  })

  return Array.from(output.data) as number[]
}
