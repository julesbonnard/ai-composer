/// <reference types="vite/client" />
declare module 'vue3-dropzone';

type Completion = {
  answer: string
  context: DocumentInterface
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