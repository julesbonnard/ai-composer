<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSourcesStore } from '@/stores/sources'
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

const currentSource = computed(() => route.name == 'source' ? getSourceById(route.params.id as string) : { title: 'Untitled source', content: '' })

function createParagraphs (content: string) {
  return content.split('\n').filter(d => d !== '').map(d => `<p>${d}</p>`).join('')
}

watch(currentSource, value => {
  if (value) {
    editor.value?.commands.setContent(`<h1>${value.title}</h1>${createParagraphs(value.content)}`)
  }
})

const RecognitionParagraph = Paragraph.extend({
  name: 'recognition-final',
  parseHTML: () => [{ tag: 'p.recognition.final' }],
  HTMLAttributes: {
    class: 'recognition final',
  }
})

const editor = useEditor({
  content: `<h1>${currentSource.value?.title || 'Untitled source'}</h1>${createParagraphs(currentSource.value?.content || '')}`,
  extensions: [
    Document.extend({
      content: 'heading paragraph+',
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

async function deleteSource () {
  await deleteSourceById(route.params.id as string)
  router.push({ name: 'home' })
}

async function save () {
  const json = (editor.value as any).getJSON()
  const title = json.content.find((d: any) => d.type === 'heading').content[0].text
  const paragraphs = json.content.filter((d: any) => d.type === 'paragraph' && d.content)
  const content = paragraphs.map((d: any) => d.content[0].text).join('\n')
  
  if (route.name === 'source') {
    await deleteSourceById(route.params.id as string)
  }
  const doc = await addSource(content, title)

  if (route.name === 'new-source') {
    router.push({ name: 'source', params: { id: doc.id } })
  }
}

</script>

<template>
  <div id="source-editor">
    <div id="actions">
      <button @click="save">Save</button>
      <button v-if="route.name == 'source'" @click="deleteSource">Delete</button>
      <RouterLink :to="{ name: 'home' }">Close</RouterLink>
    </div>
    <editor-content id="source" :editor="editor" />
  </div>
</template>

<style lang="scss" scoped>
  #source-editor {
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
  }
</style>

<style lang="scss">
  #source-editor {
    .ProseMirror {
      padding: 2rem;
      white-space: break-spaces;
      word-break: break-word;
      overflow-wrap: anywhere;

      &:focus {
        outline: 0px solid transparent;
      }

      h1 {
        font-size: 1.2rem;
        line-height: 1.4rem;
        margin-bottom: 1rem;
      }
      p {
        margin-top: 0.2em;
        font-size: 0.9rem;
        &.recognition {
          font-style: italic;
          color: grey;
        }
        &.recognition.final {
          font-size: italic;
        }
      }
    }
      /* Placeholder (on every new line) */
    .ProseMirror .is-empty::before {
      content: attr(data-placeholder);
      float: left;
      color: #bbb;
      pointer-events: none;
      height: 0;
    }
  }
</style>
