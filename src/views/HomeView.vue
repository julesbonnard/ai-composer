<script setup lang="ts">
import TiptapEditor from '../components/TiptapEditor.vue'
import SourcesDragDrop from '../components/SourcesDragDrop.vue'
import SourcesManualAdd from '../components/SourcesManualAdd.vue'
import SourcesAskNews from '../components/SourcesAskNews.vue'
import SourcesList from '../components/SourcesList.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { ref } from 'vue'
import { searchContext, autocompleteText, shortenText, alternativeText, abortGeneration } from '../plugins/ai'
import type { Doc } from '../plugins/ai'
import { toastInfo } from '../composables/useToasts'

const editorStore = useEditorStore()
const { article } = storeToRefs(editorStore)

const editor = ref<InstanceType<typeof TiptapEditor> | null>(null)

function generateCompletion(text: string, doc: Doc) {
  return () => autocompleteText(text, doc)
}

const autocompletion = async (text: string, fullText: string) => {
  const context = await searchContext(fullText)
  if (!context || context.length === 0) {
    toastInfo('Ajoutez des sources pour obtenir des complétions liées au contexte.', 'Aucune source')
    return []
  }

  return context.map((doc) => generateCompletion(text, doc))
}

const shorten = async (text: string) => {
  return shortenText(text)
}

const alternative = async (text: string) => {
  return alternativeText(text)
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
  <aside class="bg-base-200 border-r border-base-300 flex flex-col min-w-95 relative">
    <header class="flex items-center gap-2 px-4 h-14 border-b border-base-300 shrink-0">
      <span class="icon-[tabler--feather] size-5 text-primary"></span>
      <span class="font-semibold tracking-tight">AI Composer</span>
      <div class="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <RouterLink
          id="get-started"
          :to="{ name: 'settings' }"
          class="btn btn-ghost btn-sm btn-square"
          title="Settings"
        >
          <span class="icon-[tabler--settings] size-4"></span>
        </RouterLink>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="p-3 space-y-3">
        <SourcesDragDrop />
        <SourcesManualAdd />
        <SourcesAskNews />
      </div>

      <div
        class="px-4 pt-3 pb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-base-content/50"
      >
        <span class="icon-[tabler--books] size-3.5"></span> Sources
      </div>
      <SourcesList />
    </div>

    <footer class="border-t border-base-300 p-3 space-y-2 shrink-0">
      <p class="flex gap-2 text-xs leading-snug text-base-content/60">
        <span class="icon-[tabler--alert-triangle] size-4 shrink-0 text-warning mt-px"></span>
        AI is prone to mistakes — use it at your own risk and stay vigilant.
      </p>
      <div class="join w-full">
        <button class="btn btn-sm btn-soft join-item flex-1" @click="clipboard">
          <span class="icon-[tabler--clipboard] size-4"></span> Copy
        </button>
        <button class="btn btn-sm btn-soft join-item flex-1" @click="reset">
          <span class="icon-[tabler--refresh] size-4"></span> Reset
        </button>
      </div>
    </footer>
  </aside>

  <RouterView class="col-start-2 row-start-1" />

  <article class="col-start-3 overflow-y-auto">
    <TiptapEditor
      v-model="article"
      ref="editor"
      :autocompletion="autocompletion"
      :shorten="shorten"
      :alternative="alternative"
      :cancel="abortGeneration"
    />
  </article>
</template>
