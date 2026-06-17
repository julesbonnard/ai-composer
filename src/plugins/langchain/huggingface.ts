import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { useSettingsStore } from '../../stores/settings'
const { apiKeys } = useSettingsStore()
import { computed } from "vue";

const hfToken = computed(() => apiKeys['huggingface'] as { accessToken: string, userInfo: any });

export function getEmbeddings(
  model: string = "sentence-transformers/all-MiniLM-L6-v2",
) {
  return new HuggingFaceInferenceEmbeddings({
    apiKey: hfToken.value.accessToken,
    model,
  });
}

export function getLLM(
  model: string = "mistralai/Mistral-Small-24B-Instruct-2501",
) {
  return new HuggingFaceInference({
    model,
    apiKey: hfToken.value.accessToken,
  });
}
