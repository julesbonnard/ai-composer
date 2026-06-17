export default {
  transformers: {
    local: true,
    llm: ['onnx-community/Qwen2.5-0.5B-Instruct', 'Xenova/TinyLlama-1.1B-Chat-v1.0', 'Xenova/phi-2', 'mistralai/Ministral-3-3B-Instruct-2512-ONNX'],
    embeddings: ['sentence-transformers/all-MiniLM-L6-v2', 'intfloat/multilingual-e5-small'],
    auth: false
  },
  webLLM: {
    local: true,
    llm: ['Llama-3.1-8B-Instruct-q4f32_1-MLC', 'Phi-3-mini-4k-instruct'],
    embeddings: ['snowflake-arctic-embed-m-q0f32-MLC-b4'],
    auth: false
  },
  taskgenai: {
    local: true,
    llm: ['gemma3-1b-it-int4.task', 'gemma2-2b-it-gpu-int8.bin'],
    embeddings: [],
    auth: false
  },
  ollama: {
    local: true,
    llm: ['llama3.2'],
    embeddings: ['mxbai-embed-large'],
    auth: false
  },
  google: {
    local: false,
    llm: ['gemini-2.5-pro'],
    embeddings: ['gemini-embedding-001'],
    auth: 'apiKey'
  },
  huggingface: {
    local: false,
    llm: ['mistralai/Mistral-Small-24B-Instruct-2501'],
    embeddings: ['sentence-transformers/all-MiniLM-L6-v2', 'intfloat/multilingual-e5-small'],
    auth: 'oauthToken'
  },
  mistralai: {
    local: false,
    llm: ['mistral-small'],
    embeddings: ['mistral-embed'],
    auth: 'apiKey'
  },
  openai: {
    local: false,
    llm: ['gpt-4'],
    embeddings: ['text-embedding-3-large'],
    auth: 'apiKey'
  }
}