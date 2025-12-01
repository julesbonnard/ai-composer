<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { useRouter, useRoute } from 'vue-router'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Placeholder from '@tiptap/extension-placeholder'

const router = useRouter()
const route = useRoute()
const sourcesStore = useSourcesStore()
const { getSourceById, deleteSourceById, addSource } = sourcesStore

const currentSource = computed(() =>
  route.name == 'source'
    ? getSourceById(route.params.id as string)
    : { title: 'Untitled source', content: '' }
)

function createParagraphs(content: string) {
  return content
    .split('\n')
    .filter((d) => d !== '')
    .map((d) => `<p>${d}</p>`)
    .join('')
}

watch(currentSource, (value) => {
  if (value) {
    editor.value?.commands.setContent(`<h1>${value.title}</h1>${createParagraphs(value.content)}`)
  }
})

const RecognitionParagraph = Paragraph.extend({
  name: 'recognition-final',
  parseHTML: () => [{ tag: 'p.recognition.final' }],
  HTMLAttributes: {
    class: 'recognition final'
  }
})

const editor = useEditor({
  content: `<h1>${currentSource.value?.title || 'Untitled source'}</h1>${createParagraphs(currentSource.value?.content || '')}`,
  extensions: [
    Document.extend({
      content: 'heading paragraph+'
    }),
    Heading.configure({
      levels: [1]
    }),
    RecognitionParagraph,
    Paragraph,
    Text,
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return 'Type the reference name'
        }

        return ''
      }
    })
  ],
  autofocus: true,
  editable: true,
  injectCSS: true
})

async function deleteSource() {
  await deleteSourceById(route.params.id as string)
  router.push({ name: 'home' })
}

async function save() {
  const json = (editor.value as any).getJSON()
  const title = json.content.find((d: any) => d.type === 'heading').content[0].text
  const paragraphs = json.content.filter((d: any) => d.type === 'paragraph' && d.content)
  const content = paragraphs.map((d: any) => d.content[0].text).join('\n')

  if (route.name === 'source') {
    await deleteSourceById(route.params.id as string)
  }
  const { id } = await addSource(content, title)

  if (route.name === 'new-source') {
    router.push({ name: 'source', params: { id } })
  }
}
</script>

<template>
  <div class="shadow-sm overflow-y-auto">
    <div class="sticky top-0 pr-2 z-[101] join float-right">
      <button @click="save" class="btn btn-neutral btn-xs join-item">Save</button>
      <button
        v-if="route.name === 'source'"
        @click="deleteSource"
        class="btn btn-neutral btn-xs join-item"
      >
        Delete
      </button>
      <RouterLink :to="{ name: 'home' }" class="btn btn-neutral btn-xs join-item">
        Close
      </RouterLink>
    </div>

    <editor-content :editor="editor" />
  </div>
</template>
