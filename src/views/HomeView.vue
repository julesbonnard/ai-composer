<script setup lang="ts">
import { Analytics } from '@vercel/analytics/vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import SourcesUploader from '../components/SourcesUploader.vue'
import SourcesList from '../components/SourcesList.vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { useSourcesStore } from '@/stores/sources'
import { ref } from 'vue'
import { getChatCompletion } from '@/plugins/llm'
import prompts from '../prompts/index'

const editorStore = useEditorStore()
const { article } = storeToRefs(editorStore)

const sourcesStore = useSourcesStore()
const { search } = sourcesStore

const editor = ref<InstanceType<typeof TiptapEditor> | null>(null)

const lang = 'fr'

type SimilarItem = {
  hits: number
  id: string
  metadata: {
    title: string
  }
  text: string
  score: number
  timestamp: number
}

const autocompletion = async (text: string) => {
  const semanticSearch = await search(text)
  
  if (!semanticSearch || semanticSearch.similarItems.length === 0) {
    throw 'No similar items found'
  }

  return (semanticSearch.similarItems as SimilarItem[]).map(similarItem => 
   (() => {
    let cachedPromise: Promise<any> | null = null
    
    return () => {
      if (cachedPromise) {
        return cachedPromise
      } else {
        cachedPromise = getChatCompletion({
          model: 'mistral-small-latest',
          messages: prompts[lang].autocompletion(
            text, {
              content: similarItem.text, 
              name: similarItem.metadata.title
            }
          ),
          temperature: 0.3,
          stop: ["."],
          stream: false
        })
        .then(choices => {
          if (!choices || choices.length === 0 || !choices[0].message.content) {
            throw 'No completion found'
          }
          return {
            answer: choices[0].message.content.slice(text.length),
            context: {
              content: similarItem.text,
              name: similarItem.metadata.title,
              id: similarItem.id
            }
          }
        })
        return cachedPromise
      }
    }
  })())
}

const shorten = async (text: string) => {
  const choices = await getChatCompletion({
    model: 'mistral-small-latest',
    messages: prompts[lang].shorten(text),
    maxTokens: 300,
    stop: []
  })

  if (!choices || choices.length === 0 || !choices[0].message.content) {
    throw 'No completion found'
  }

  return choices[0].message.content as string
}

const alternative = async (text: string) => {
  const choices = await getChatCompletion({
    model: 'mistral-small-latest',
    messages: prompts[lang].alternative(text),
    maxTokens: 300,
    stop: []
  })

  if (!choices || choices.length === 0 || !choices[0].message.content) {
    throw 'No completion found'
  }

  return choices[0].message.content as string
}

async function clipboard() {
  const html = editor.value?.exportHTML()
  if (!html) return false
  await navigator.clipboard.writeText(html);
}

async function reset () {
  await sourcesStore.$reset()
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