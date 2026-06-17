import { defineStore } from 'pinia'
import { useStorage, StorageSerializers } from '@vueuse/core'
import modelsConfig from '../config/models'

export interface ModelSelection {
  provider: keyof typeof modelsConfig
  model: string
}

export type ApiKey = string | null | { clientId: string | null; clientSecret: string | null } | { accessToken: string | null, userInfo: any }

export interface ApiKeys {
  [provider: string]: ApiKey
}

export interface ContextSelection {
  provider: string
  clientId: string
  clientSecret: string
}

const modelsRequiringApiKey = Object.entries(modelsConfig)
  .filter(([_, config]) => config.auth !== false)
  .reduce((acc, [key, config]) => {
    if (config.auth === 'apiKey') {
      acc[key] = null
    } else if (config.auth === 'oauthToken') {
      acc[key] = { accessToken: null, userInfo: null }
    } else if (config.auth === 'clientCredentials') {
      acc[key] = { clientId: null, clientSecret: null }
    }
    return acc
  }, {} as ApiKeys)

export const useSettingsStore = defineStore('settings', () => {
  const apiKeys = useStorage<ApiKeys>(
    'ai-composer-api-keys',
    modelsRequiringApiKey,
    localStorage,
    { serializer: StorageSerializers.object }
  )

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

  const contextSelection = useStorage<ContextSelection>(
    'ai-composer-context-selection',
    { provider: 'asknews', clientId: '', clientSecret: '' },
    localStorage,
    { serializer: StorageSerializers.object }
  )

  return {
    apiKeys,
    llmSelection,
    embeddingsSelection,
    contextSelection
  }
})
