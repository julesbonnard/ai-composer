/// <reference types="vite/client" />
declare module 'vue3-dropzone';

type Completion = {
  answer: string
  context: {
    id?: string
    pageContent: string
    // offset = position (en caractères) du chunk dans le contenu de la source,
    // pour resurligner le segment exact à l'ouverture.
    metadata: { title?: string; id?: string; name?: string; offset?: number }
  }
}

type Dtype =
  | "auto"
  | "fp32"
  | "fp16"
  | "q8"
  | "int8"
  | "uint8"
  | "q4"
  | "bnb4"
  | "q4f16"
  | Record<
    string,
    "auto" | "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16"
  >
  | undefined;