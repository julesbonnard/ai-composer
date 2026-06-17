import { type SearchResponse } from '@emergentmethods/asknews-typescript-sdk'

import { useSettingsStore } from '../stores/settings'

const API_URL = "/api/asknews";

export async function fetchNewsContext(text: string): Promise<SearchResponse> {
  const { contextSelection } = useSettingsStore()
  
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: text,
      domainUrl: ['afp.com'],
      clientId: contextSelection.clientId,
      clientSecret: contextSelection.clientSecret
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.statusText}`);
  }

  return response.json();
}
