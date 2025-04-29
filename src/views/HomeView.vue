<script setup lang="ts">
import { Analytics } from '@vercel/analytics/vue'
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
    let completion = await getChatCompletion(
      prompts[lang].autocompletion(text, similarItem)
    )

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

  return semanticSearch.map(semanticResult => generateCompletion(text, semanticResult))
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
  await navigator.clipboard.writeText(html);
}

async function reset () {
  editorStore.$reset()
  editor.value?.reset()
}

</script>

<template>
  <Analytics />
  <main>
    <routerView />
    <aside>
      <RouterLink class="get-started" :to="{ name: 'get-started' }">Get started</RouterLink>
      <SourcesUploader />
      <SourcesList />
      <button class="copy" @click="clipboard">Copy to clipboard</button>
      <p class="warning">
        Keep in mind that artificial intelligence is prone to making a lot of mistakes, so use it at your own risk and be vigilant.
      </p>
      <button class="reset" @click="reset">Reset</button>
    </aside>
    <article>
      <TiptapEditor v-model="article" ref="editor" :autocompletion="autocompletion" :shorten="shorten" :alternative="alternative" />
    </article>
  </main>
</template>

<style lang="scss">
main {
  height: 100%;
  display: grid; 
  grid-template-columns: 0.4fr 0fr 1.6fr; 
  grid-template-rows: 1fr; 
  gap: 0px 0px;
  grid-template-areas: "aside source article";
  transition: 150ms;

  &:has(> #source-editor), &:has(> #get-started) {
    grid-template-columns: 0.4fr 0.7fr 0.9fr;
  }
}
aside {
  grid-area: aside;
  position: relative;
  width: 100%;
  height: 100%;
  background-color: white;
  // padding: 2rem 1rem 0 2rem;
  box-shadow: 10px 0px 15px -3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;

  // .fixed {
  //   position: sticky;
  //   top: 32px;
  //   width: 100%;
  //   height: 90vh;
  // }

  button, .get-started {
    background-color: #8232eb; /* Green */
    border: none;
    color: white;
    padding: 15px 32px;
    font-size: 16px;
    text-align: center;
    text-decoration: none;
    width: 100%;
    cursor: pointer;
    &:hover {
      background-color: rgba(#8232eb, 0.9);
    }
    &:disabled {
      cursor: default;
      background-color: #ccc;
    }
    &.copy {
      margin-top: auto;
    }
    &.reset {
      padding: 7px 24px;
      font-size: 14px;
    }
  }

  .warning {
    margin: 2rem 14px;
    color: #8232eb;
    text-align: center;
    justify-self: end;
  }
}
article {
  grid-area: article;
  padding-bottom: 12em;
  caret-color: #8232eb;
  position: relative;
  height: 100%;
  overflow-y: auto;
}
footer {
  grid-area: footer;
}
.ai-generated {
  text-decoration-color: lightcoral;
  text-decoration-line: underline;
}
</style>