<script setup lang="ts">
import { getApiKey, setApiKey } from '@/plugins/llm';
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

const apiKey = ref(getApiKey());

watch(apiKey, (newValue: string) => {
  setApiKey(newValue);
});

</script>

<template>
  <div id="get-started">
    <div id="actions">
      <RouterLink :to="{ name: 'home' }">Close</RouterLink>
    </div>
    <div id="content">
      <h1>Get started</h1>
      <p>Welcome to AI Composer. This webapp allows journalists to be assisted by AI in the process of writing articles.</p>
      <p>It is not a replacement for human writing, but a tool to help journalists to write faster and better. It has been developed with privacy and praticity in mind.</p>
      <p>To understand how it differs from automatic writing, you can read <a href="https://julesbonnard.github.io/ai-composer/" target="_blank">these slides</a>.</p>

      <h2>Mistral API Key</h2>
      <p>Your sources and their embeddings are generated in-browser and stored locally, but you'll need an API key to use the LLM features and generate completions. You can easily get one from Mistral AI <a href="https://console.mistral.ai/api-keys" target="_blank">here</a> (free for experimental use, then pay as you go). It will be saved in the local storage.</p>
      <p>Api Key: <input type="text" v-model="apiKey" placeholder="Mistral API Key" /></p>
      <p>The app currently uses the mistral-small LLM model, and will allow you to use a self-hosted version is a near future.</p>
      <p>This webapp is not affiliated with Mistral AI.</p>

      <h2>How to</h2>
      <p>You can add new sources on the left panel, like press releases, reports, notes or interviews. Then, press tab in the process of writing to get suggestions.</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  #get-started {
    background-color: #fff;
    box-shadow: 10px 0px 15px -3px rgba(0,0,0,0.1);
    height: 100%;
    overflow-y: auto;
    grid-area: source;
    position: relative;
    #actions {
      position: sticky;
      top: 0px;
      float: right;
      padding-right: 8px;
      background-color: white;
      z-index: 101;
      button, a {
        background-color: #8232eb; /* Green */
        border: none;
        color: white;
        padding: 8px 12px;
        margin: 0px 6px 0px 6px;
        font-size: 12px;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        &:hover {
          background-color: rgba(#8232eb, 0.9);
        }
      }
    }
    #content {
      padding: 2rem;
      h1, h2, p {
        margin-bottom: 1rem;
      }
      input {
        padding: 0.6rem 0.8rem;
      }
    }
  }
</style>
