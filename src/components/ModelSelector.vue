<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStorage, StorageSerializers } from '@vueuse/core'
import modelsConfig from '../config/models'
import { hfToken, shouldUseHfOAuth } from '../plugins/HuggingFace'

// Types pour la sélection
interface ModelSelection {
  provider: string
  model: string
}

interface ApiKeys {
  google: string
  openai: string
  mistralai: string
}

// Storage avec useStorage
const llmSelection = useStorage<ModelSelection>(
  'ai-composer-llm-selection',
  { provider: 'openai', model: 'gpt-4' },
  localStorage,
  { serializer: StorageSerializers.object }
)

const embeddingsSelection = useStorage<ModelSelection>(
  'ai-composer-embeddings-selection',
  { provider: 'openai', model: 'text-embedding-3-large' },
  localStorage,
  { serializer: StorageSerializers.object }
)

const apiKeys = useStorage<ApiKeys>(
  'ai-composer-api-keys',
  { google: '', openai: '', mistralai: '' },
  localStorage,
  { serializer: StorageSerializers.object }
)

// Liste des providers disponibles
const providers = Object.keys(modelsConfig) as Array<keyof typeof modelsConfig>

// Computed pour les modèles disponibles
const availableLlmModels = computed(() => {
  const provider = llmSelection.value.provider as keyof typeof modelsConfig
  return modelsConfig[provider]?.llm || []
})

const availableEmbeddingsModels = computed(() => {
  const provider = embeddingsSelection.value.provider as keyof typeof modelsConfig
  return modelsConfig[provider]?.embeddings || []
})

// Watcher pour réinitialiser le modèle si le provider change et que le modèle n'existe plus
watch(() => llmSelection.value.provider, (newProvider) => {
  const provider = newProvider as keyof typeof modelsConfig
  const models = modelsConfig[provider]?.llm || []
  if (models.length > 0 && !models.includes(llmSelection.value.model)) {
    llmSelection.value.model = models[0] || ''
  }
})

watch(() => embeddingsSelection.value.provider, (newProvider) => {
  const provider = newProvider as keyof typeof modelsConfig
  const models: string[] = modelsConfig[provider]?.embeddings || []
  if (models.length > 0 && !models.includes(embeddingsSelection.value.model)) {
    embeddingsSelection.value.model = models[0] || ''
  }
})

// Fonction pour vérifier si un provider est local
function isLocalProvider(provider: string): boolean {
  return modelsConfig[provider as keyof typeof modelsConfig]?.local || false
}

// Fonction pour vérifier si on doit afficher le champ API key
function shouldShowApiKeyField(provider: string): boolean {
  return !isLocalProvider(provider) && provider !== 'huggingface'
}
</script>

<template>
  <div class="space-y-8 p-6 py-0">
    <h2 class="text-1xl font-semibold mb-6">AI models choice</h2>

    <!-- Section LLM -->
    <div class="card bg-base-200">
      <div class="card-body">
        <h3 class="card-title">Large Language Model (LLM)</h3>
        
        <!-- Sélection du provider -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Provider</span>
          </label>
          <select v-model="llmSelection.provider" class="select select-bordered w-full">
            <option v-for="provider in providers" :key="provider" :value="provider">
              {{ provider }}
            </option>
          </select>
          <label class="label">
            <span class="label-text-alt">
              <span v-if="isLocalProvider(llmSelection.provider)" class="badge badge-success gap-2">
                Local
              </span>
              <span v-else class="badge badge-info gap-2">
                Cloud
              </span>
            </span>
          </label>
        </div>

        <!-- Sélection du modèle -->
        <div class="form-control" v-if="availableLlmModels.length > 0">
          <label class="label">
            <span class="label-text">Model</span>
          </label>
          <select v-model="llmSelection.model" class="select select-bordered w-full">
            <option v-for="model in availableLlmModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>

        <!-- Champ API Key pour providers distants -->
        <div 
          v-if="shouldShowApiKeyField(llmSelection.provider)" 
          class="form-control"
        >
          <label class="label">
            <span class="label-text">API Key {{ llmSelection.provider }}</span>
          </label>
          <input 
            v-model="apiKeys[llmSelection.provider as keyof ApiKeys]"
            type="password" 
            placeholder="Entrez votre clé API" 
            class="input input-bordered w-full"
          />
        </div>

        <!-- Message pour HuggingFace OAuth -->
        <div v-if="llmSelection.provider === 'huggingface'" class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span v-if="hfToken">✓ Connecté avec HuggingFace OAuth</span>
          <span v-else>Connectez-vous via OAuth HuggingFace</span>
        </div>
      </div>
    </div>

    <!-- Section Embeddings -->
    <div class="card bg-base-200">
      <div class="card-body">
        <h3 class="card-title">Embeddings model</h3>
        
        <!-- Sélection du provider -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Provider</span>
          </label>
          <select v-model="embeddingsSelection.provider" class="select select-bordered w-full">
            <option v-for="provider in providers" :key="provider" :value="provider">
              {{ provider }}
            </option>
          </select>
          <label class="label">
            <span class="label-text-alt">
              <span v-if="isLocalProvider(embeddingsSelection.provider)" class="badge badge-success gap-2">
                Local
              </span>
              <span v-else class="badge badge-info gap-2">
                Cloud
              </span>
            </span>
          </label>
        </div>

        <!-- Sélection du modèle -->
        <div class="form-control" v-if="availableEmbeddingsModels.length > 0">
          <label class="label">
            <span class="label-text">Model</span>
          </label>
          <select v-model="embeddingsSelection.model" class="select select-bordered w-full">
            <option v-for="model in availableEmbeddingsModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>
        <div v-else class="alert alert-warning">
          <span>Ce provider ne propose pas de modèles d'embeddings</span>
        </div>

        <!-- Champ API Key pour providers distants -->
        <div 
          v-if="shouldShowApiKeyField(embeddingsSelection.provider)" 
          class="form-control"
        >
          <label class="label">
            <span class="label-text">Clé API {{ embeddingsSelection.provider }}</span>
          </label>
          <input 
            v-model="apiKeys[embeddingsSelection.provider as keyof ApiKeys]"
            type="password" 
            placeholder="Entrez votre clé API" 
            class="input input-bordered w-full"
          />
        </div>

        <!-- Message pour HuggingFace OAuth -->
        <div v-if="embeddingsSelection.provider === 'huggingface'" class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span v-if="hfToken">✓ Logged in with HuggingFace OAuth</span>
          <span v-else>Log in via OAuth HuggingFace</span>
        </div>
      </div>
    </div>
  </div>
</template>
