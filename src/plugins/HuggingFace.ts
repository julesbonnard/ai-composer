import { useStorage, StorageSerializers } from '@vueuse/core'
import { oauthLoginUrl, oauthHandleRedirectIfPresent } from '@huggingface/hub'
import { InferenceClient } from '@huggingface/inference'
import { computed } from 'vue'
import { llmProvider, embeddingsProvider } from './langchain'

export const hfToken = useStorage('ai-composer-oauth', null, localStorage, {
  serializer: StorageSerializers.object
})

export const shouldUseHfOAuth = computed(() => {
  return (llmProvider.provider === 'huggingface' || embeddingsProvider.provider === 'huggingface') && !hfToken.value
})

export async function handleHfLoginRedirect() {
  const result = await oauthHandleRedirectIfPresent()
  if (result) {
    hfToken.value = result
  }
}

export async function handleHfLogin() {
  window.location.href =
    (await oauthLoginUrl({
      clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
      scopes: import.meta.env.VITE_OAUTH_SCOPES,
      redirectUrl: import.meta.env.VITE_OAUTH_REDIRECT_URL
    })) + '&prompt=consent'
}

export const inferenceClient = computed(() => new InferenceClient(hfToken.value?.accessToken))
