// import { Mistral } from '@mistralai/mistralai'
// import type { ChatCompletionRequest } from '@mistralai/mistralai/models/components';

// export function getApiKey () {
//   return localStorage.getItem('mistral-apiKey') || ''
// }

// let client = new Mistral({ apiKey: getApiKey()});

// export function setApiKey (apiKey: string) {
//   localStorage.setItem('mistral-apiKey', apiKey);
//   client = new Mistral({apiKey});
// }

// export async function getChatCompletion (options: ChatCompletionRequest) {
//   const { choices } = await client.chat.complete(options)

//   return choices
// }
