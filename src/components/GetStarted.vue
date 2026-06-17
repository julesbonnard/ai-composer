<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="bg-base-100 border-r border-base-300 overflow-y-auto">
    <div class="sticky top-0 right-2 z-101 float-right">
      <RouterLink :to="{ name: 'home' }" class="btn btn-neutral btn-xs">Close</RouterLink>
    </div>

    <div class="p-8">
      <h1 class="mb-4 text-2xl font-bold">Get started</h1>
      <p class="mb-4">
        Welcome to AI Composer. This webapp allows journalists to be assisted by AI in the process
        of writing articles.
      </p>
      <p class="mb-4">
        It is not a replacement for human writing, but a tool to help journalists to write faster
        and better. It has been developed with privacy and praticity in mind.
      </p>
      <p class="mb-4">
        To understand how it differs from automatic writing, you can read
        <a href="https://julesbonnard.github.io/ai-composer/" target="_blank" class="text-accent">
          these slides </a
        >.
      </p>

      <!-- <h2 class="mb-2 font-semibold">Mistral API Key</h2>
      <p class="mb-4">
        Your sources and their embeddings are generated in-browser and stored locally, but you'll
        need an API key to use the LLM features and generate completions. You can easily get one
        from Mistral AI
        <a href="https://console.mistral.ai/api-keys" target="_blank" class="text-accent"> here </a>
        (free for experimental use, then pay as you go). It will be saved in the local storage.
      </p>
      <p class="mb-4">
        <input type="text" v-model="apiKey" placeholder="Mistral API Key" class="input" />
      </p>
      <p class="mb-4">
        The app currently uses the mistral-small LLM model, and will allow you to use a self-hosted
        version is a near future.
      </p>
      <p class="mb-4">This webapp is not affiliated with Mistral AI.</p> -->

      <h2 class="mb-3 font-semibold">How to</h2>
      <p class="mb-4">
        You can add new sources on the left panel, like press releases, reports, notes or
        interviews. Then, press tab in the process of writing to get suggestions.
      </p>
    </div>
  </div>
</template>
