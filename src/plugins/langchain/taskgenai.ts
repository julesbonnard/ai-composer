import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";

const modelFileName = "gemma3-1b-it-int4.task";
// const modelFileName = "gemma2-2b-it-gpu-int8.bin";

let llmInference: LlmInference;

async function load(modelFileName: string) {
  if (llmInference) {
    return llmInference;
  }
  const genaiFileset = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm",
  );

  const llm = await LlmInference.createFromOptions(genaiFileset, {
      baseOptions: { modelAssetPath: modelFileName },
      maxTokens: 2048,  // The maximum number of tokens (input tokens + output
                       // tokens) the model handles.
      randomSeed: 1,   // The random seed used during text generation.
      topK: 1,  // The number of tokens the model considers at each step of
                // generation. Limits predictions to the top k most-probable
                // tokens. Setting randomSeed is required for this to make
                // effects.
      temperature:
          0.1,  // The amount of randomness introduced during generation.
                // Setting randomSeed is required for this to make effects.
    })
  
  llmInference = llm;
  return llmInference;
}

function transformToGemmaPrompt(messages: BaseLanguageModelInput): string {
  // Si c'est déjà une string, on la retourne directement
  if (typeof messages === 'string') {
    return `<start_of_turn>user\n${messages}<end_of_turn>\n<start_of_turn>model\n`;
  }

  // Si c'est un tableau de messages
  if (Array.isArray(messages)) {
    let prompt = '';
    
    for (const message of messages) {
      if (typeof message == 'string') {
        prompt += `<start_of_turn>user\n${message}<end_of_turn>\n`;
        continue;
      }

      if (!('type' in message) || !('content' in message)) {
        throw new Error("Invalid message format");
      }

      // Extraire le rôle et le contenu du message
      const role = message.type || 'user';
      const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      
      // Mapper les rôles LangChain vers les rôles Gemma
      let gemmaRole = 'user';
      if (role === 'assistant' || role === 'ai') {
        gemmaRole = 'model';
      } else if (role === 'system') {
        // Les messages système peuvent être traités comme des messages utilisateur
        gemmaRole = 'user';
      }
      
      prompt += `<start_of_turn>${gemmaRole}\n${content}<end_of_turn>\n`;
    }
    
    // Ajouter le début du tour pour le modèle
    prompt += '<start_of_turn>model\n';
    
    return prompt;
  }
  
  // Fallback : convertir en string
  return `<start_of_turn>user\n${String(messages)}<end_of_turn>\n<start_of_turn>model\n`;
}
async function handleGenerate(messages: BaseLanguageModelInput): Promise<{ content: string; role: string }> {
  const llm = await load(modelFileName);
  const prompt = transformToGemmaPrompt(messages);
  const output = await llm.generateResponse(prompt);
  return { content: output, role: 'assistant' };
}

async function handleEmbed(content: string | string[]): Promise<number[] | number[][]> {
  throw new Error("Embeddings not supported yet");
}

export function getLLM() {
  return {
    stream: async (messages: BaseLanguageModelInput) => {
      return handleGenerate(messages);
    },
    invoke: async (messages: BaseLanguageModelInput) => {
      return handleGenerate(messages);
    }
  }
}

export function getEmbeddings() {
  return {
    embedDocuments (content: string[]): Promise<number[][]> {
      return handleEmbed(content) as Promise<number[][]>;
    },
    embedQuery (content: string): Promise<number[]> {
      return handleEmbed(content) as Promise<number[]>;
    }
  }
}