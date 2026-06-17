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
watch(() => llmSelection.provider, (newProvider) => {
  const provider = newProvider as keyof typeof modelsConfig
  const models = modelsConfig[provider]?.llm || []
  if (models.length > 0 && !models.includes(llmSelection.model)) {
    llmSelection.model = models[0] || ''
  }
})

watch(() => embeddingsSelection.provider, (newProvider) => {
  const provider = newProvider as keyof typeof modelsConfig
  const models: string[] = modelsConfig[provider]?.embeddings || []
  if (models.length > 0 && !models.includes(embeddingsSelection.model)) {
    embeddingsSelection.model = models[0] || ''
  }
})

// Fonction pour vérifier si un provider est local
function isLocalProvider(provider: string): boolean {
  return modelsConfig[provider as keyof typeof modelsConfig]?.local || false
}

// Fonction pour vérifier si on doit afficher le champ API key
function shouldShowApiKeyField(provider: string): boolean {
  return  modelsConfig[provider as keyof typeof modelsConfig]?.auth === 'apiKey'
}
</script>

<template>
  <div class="space-y-8 p-6 py-0">
    <!-- Section LLM -->
    <div class="card bg-base-200">
      <div class="card-body">
        <!-- Sélection du provider -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">LLM provider</span>
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
      </div>
    </div>

    <!-- Section Embeddings -->
    <div class="card bg-base-200">
      <div class="card-body">
        
        <!-- Sélection du provider -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Embeddings provider</span>
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
      </div>
    </div>

    <!-- Message pour HuggingFace OAuth -->
    <div v-if="llmSelection.provider === 'huggingface' || embeddingsSelection.provider === 'huggingface'" class="alert alert-info">
      <SigninHF class="mx-auto btn btn-ghost" />
    </div>

    <div class="card bg-base-200">
      <div class="card-body">

        <div class="form-control">
          <label class="label">
            <span class="label-text">Context provider</span>
          </label>
          <select v-model="contextSelection.provider" class="select select-bordered w-full">
            <option value="asknews">
              AskNews
            </option>
          </select>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Client ID</span>
          </label>
          <input 
            v-model="contextSelection.clientId"
            type="text" 
            placeholder="Enter your Client ID"
            class="input input-bordered w-full"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Client Secret</span>
          </label>
          <input 
            v-model="contextSelection.clientSecret"
            type="password" 
            placeholder="Enter your Client Secret"
            class="input input-bordered w-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>
