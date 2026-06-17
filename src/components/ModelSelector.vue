<script setup lang="ts">
import { computed, watch } from 'vue'
import modelsConfig from '../config/models'
import { useSettingsStore } from '../stores/settings'
import type { ApiKeys } from '../stores/settings'
import SigninHF from './SigninHF.vue'

const { apiKeys, llmSelection, embeddingsSelection, contextSelection } = useSettingsStore()

// Liste des providers disponibles
const providers = Object.keys(modelsConfig) as Array<keyof typeof modelsConfig>

// Computed pour les modèles disponibles
const availableLlmModels = computed(() => {
  const provider = llmSelection.provider as keyof typeof modelsConfig
  return modelsConfig[provider]?.llm || []
})

const availableEmbeddingsModels = computed(() => {
  const provider = embeddingsSelection.provider as keyof typeof modelsConfig
  return modelsConfig[provider]?.embeddings || []
})

// Watcher pour réinitialiser le modèle si le provider change et que le modèle n'existe plus
watch(
  () => llmSelection.provider,
  (newProvider) => {
    const provider = newProvider as keyof typeof modelsConfig
    const models = modelsConfig[provider]?.llm || []
    if (models.length > 0 && !models.includes(llmSelection.model)) {
      llmSelection.model = models[0] || ''
    }
  }
)

watch(
  () => embeddingsSelection.provider,
  (newProvider) => {
    const provider = newProvider as keyof typeof modelsConfig
    const models: string[] = modelsConfig[provider]?.embeddings || []
    if (models.length > 0 && !models.includes(embeddingsSelection.model)) {
      embeddingsSelection.model = models[0] || ''
    }
  }
)

// Fonction pour vérifier si un provider est local
function isLocalProvider(provider: string): boolean {
  return modelsConfig[provider as keyof typeof modelsConfig]?.local || false
}

// Fonction pour vérifier si on doit afficher le champ API key
function shouldShowApiKeyField(provider: string): boolean {
  return modelsConfig[provider as keyof typeof modelsConfig]?.auth === 'apiKey'
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-xl">
    <!-- Section LLM -->
    <section class="rounded-box border border-base-300 bg-base-200/40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold flex items-center gap-2">
          <span class="icon-[tabler--sparkles] size-4 text-primary"></span> Generation
        </h2>
        <span v-if="isLocalProvider(llmSelection.provider)" class="badge badge-sm badge-success gap-1">
          <span class="icon-[tabler--device-laptop] size-3"></span> Local
        </span>
        <span v-else class="badge badge-sm badge-info gap-1">
          <span class="icon-[tabler--cloud] size-3"></span> Cloud
        </span>
      </div>
      <p class="text-xs text-base-content/60 -mt-2">
        Model that completes your sentences from the sources.
      </p>

      <label class="block">
        <span class="text-sm font-medium text-base-content/70">Provider</span>
        <select v-model="llmSelection.provider" class="select select-bordered w-full mt-1">
          <option v-for="provider in providers" :key="provider" :value="provider">
            {{ provider }}
          </option>
        </select>
      </label>

      <label class="block" v-if="availableLlmModels.length > 0">
        <span class="text-sm font-medium text-base-content/70">Model</span>
        <select v-model="llmSelection.model" class="select select-bordered w-full mt-1">
          <option v-for="model in availableLlmModels" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
      </label>

      <label class="block" v-if="shouldShowApiKeyField(llmSelection.provider)">
        <span class="text-sm font-medium text-base-content/70">API key — {{ llmSelection.provider }}</span>
        <input
          v-model="apiKeys[llmSelection.provider as keyof ApiKeys]"
          type="password"
          placeholder="Enter your API key"
          class="input input-bordered w-full mt-1"
        />
      </label>
    </section>

    <!-- Section Embeddings -->
    <section class="rounded-box border border-base-300 bg-base-200/40 p-5 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold flex items-center gap-2">
          <span class="icon-[tabler--vector-triangle] size-4 text-primary"></span> Embeddings
        </h2>
        <span
          v-if="isLocalProvider(embeddingsSelection.provider)"
          class="badge badge-sm badge-success gap-1"
        >
          <span class="icon-[tabler--device-laptop] size-3"></span> Local
        </span>
        <span v-else class="badge badge-sm badge-info gap-1">
          <span class="icon-[tabler--cloud] size-3"></span> Cloud
        </span>
      </div>
      <p class="text-xs text-base-content/60 -mt-2">
        Vectorizes your sources for relevance search (runs locally for privacy).
      </p>

      <label class="block">
        <span class="text-sm font-medium text-base-content/70">Provider</span>
        <select v-model="embeddingsSelection.provider" class="select select-bordered w-full mt-1">
          <option v-for="provider in providers" :key="provider" :value="provider">
            {{ provider }}
          </option>
        </select>
      </label>

      <label class="block" v-if="availableEmbeddingsModels.length > 0">
        <span class="text-sm font-medium text-base-content/70">Model</span>
        <select v-model="embeddingsSelection.model" class="select select-bordered w-full mt-1">
          <option v-for="model in availableEmbeddingsModels" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
      </label>
      <div v-else role="alert" class="alert alert-warning alert-soft">
        <span class="icon-[tabler--alert-triangle] size-5"></span>
        <span>This provider does not offer embeddings models</span>
      </div>

      <label class="block" v-if="shouldShowApiKeyField(embeddingsSelection.provider)">
        <span class="text-sm font-medium text-base-content/70"
          >API key — {{ embeddingsSelection.provider }}</span
        >
        <input
          v-model="apiKeys[embeddingsSelection.provider as keyof ApiKeys]"
          type="password"
          placeholder="Enter your API key"
          class="input input-bordered w-full mt-1"
        />
      </label>
    </section>

    <!-- Message pour HuggingFace OAuth -->
    <div
      v-if="llmSelection.provider === 'huggingface' || embeddingsSelection.provider === 'huggingface'"
      role="alert"
      class="alert alert-info alert-soft"
    >
      <SigninHF class="mx-auto btn btn-ghost btn-sm" />
    </div>

    <!-- Section contexte externe -->
    <section class="rounded-box border border-base-300 bg-base-200/40 p-5 space-y-4">
      <h2 class="font-semibold flex items-center gap-2">
        <span class="icon-[tabler--news] size-4 text-primary"></span> Context source
      </h2>
      <p class="text-xs text-base-content/60 -mt-2">
        External news provider used to fetch background context.
      </p>

      <label class="block">
        <span class="text-sm font-medium text-base-content/70">Provider</span>
        <select v-model="contextSelection.provider" class="select select-bordered w-full mt-1">
          <option value="asknews">AskNews</option>
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-base-content/70">Client ID</span>
        <input
          v-model="contextSelection.clientId"
          type="text"
          placeholder="Enter your Client ID"
          class="input input-bordered w-full mt-1"
        />
      </label>

      <label class="block">
        <span class="text-sm font-medium text-base-content/70">Client Secret</span>
        <input
          v-model="contextSelection.clientSecret"
          type="password"
          placeholder="Enter your Client Secret"
          class="input input-bordered w-full mt-1"
        />
      </label>
    </section>
  </div>
</template>
