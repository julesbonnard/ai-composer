import { oauthLoginUrl, oauthHandleRedirectIfPresent } from '@huggingface/hub'
import { InferenceClient } from '@huggingface/inference'
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const { apiKeys } = useSettingsStore()

export async function handleHfLoginRedirect() {
  const result = await oauthHandleRedirectIfPresent()
  if (result) {
    apiKeys['huggingface'] = result
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

export const huggingFaceToken = computed(() => apiKeys['huggingface'] as { accessToken: string, userInfo: any })

export const logoutHf = () => {
  apiKeys['huggingface'] = null
}

export const inferenceClient = computed(() => new InferenceClient(huggingFaceToken.value?.accessToken as string))
