<script setup lang="ts">
import TiptapEditor from '../components/TiptapEditor.vue'
import SourcesUploader from '../components/SourcesUploader.vue'
import SourcesList from '../components/SourcesList.vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { ref } from 'vue'
import { getChatCompletion, similaritySearch } from '@/plugins/langchain'
import prompts from '../prompts/index'
import type { DocumentInterface } from '@langchain/core/documents'

const editorStore = useEditorStore()
const { article } = storeToRefs(editorStore)

const editor = ref<InstanceType<typeof TiptapEditor> | null>(null)

const lang = 'fr'

function generateCompletion(text: string, similarItem: DocumentInterface) {
  return async () => {
    let completion = await getChatCompletion(prompts[lang].autocompletion(text, similarItem))

    if (!completion) {
      throw 'No completion found'
    }

    if (typeof completion.content === 'string' && completion.content.startsWith(text)) {
      completion.content = completion.content.slice(text.length)
    }

    return {
      answer: completion.content,
      context: similarItem
    }
  }
}

const autocompletion = async (text: string) => {
  const semanticSearch = await similaritySearch(text)

  if (!semanticSearch || semanticSearch.length === 0) {
    throw 'No similar items found'
  }

  return semanticSearch.map((semanticResult) => generateCompletion(text, semanticResult))
}

const shorten = async (text: string) => {
  const result = await getChatCompletion(prompts[lang].shorten(text))

  if (!result) {
    throw 'No completion found'
  }

  return result
}

const alternative = async (text: string) => {
  const result = await getChatCompletion(prompts[lang].alternative(text))

  if (!result) {
    throw 'No completion found'
  }

  return result
}

async function clipboard() {
  const html = editor.value?.exportHTML()
  if (!html) return false
  await navigator.clipboard.writeText(html)
}

async function reset() {
  editorStore.$reset()
  editor.value?.reset()
}
</script>

<template>
  <RouterView class="col-start-2 row-start-1" />
  <aside class="shadow-md flex flex-col">
    <RouterLink id="get-started" class="btn btn-lg btn-primary" :to="{ name: 'get-started' }">
      Get started
    </RouterLink>
    <SourcesUploader class="flex-1" />
    <SourcesList />
    <button class="btn btn-soft" @click="clipboard">Copy to clipboard</button>
    <div role="alert" class="alert alert-warning">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span
        >Keep in mind that artificial intelligence is prone to making a lot of mistakes, so use it
        at your own risk and be vigilant.</span
      >
    </div>
    <button class="btn btn-soft" @click="reset">Reset</button>
  </aside>

  <article class="col-start-3 overflow-y-auto">
    <TiptapEditor
      v-model="article"
      ref="editor"
      :autocompletion="autocompletion"
      :shorten="shorten"
      :alternative="alternative"
    />
  </article>
</template>
