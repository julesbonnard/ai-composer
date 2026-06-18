<script setup lang="ts">
import { computed, watch, onMounted, nextTick } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { useRouter, useRoute } from 'vue-router'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Placeholder from '@tiptap/extension-placeholder'
import SourceHighlight, { sourceHighlightKey } from '../plugins/SourceHighlight'
import { sourceHighlight } from '../composables/useSourceHighlight'

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
    SourceHighlight,
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

// Convertit un offset (en caractères dans le contenu source) en position ProseMirror.
// Le doc est `<h1>titre</h1>` + un paragraphe par ligne NON VIDE (cf. createParagraphs),
// donc on apparie dans l'ordre les lignes non vides du contenu aux paragraphes du doc.
function offsetToPos(content: string, offset: number): number | null {
  const view = editor.value?.view
  if (!view) return null
  const paragraphs: { textStart: number; len: number }[] = []
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') paragraphs.push({ textStart: pos + 1, len: node.textContent.length })
  })

  const lines = content.split('\n')
  let acc = 0
  let rendered = -1
  for (const line of lines) {
    const start = acc
    const end = acc + line.length
    if (line !== '') rendered++
    if (offset >= start && offset <= end) {
      const para = line !== '' ? paragraphs[rendered] : paragraphs[rendered + 1]
      if (!para) return null
      return para.textStart + (line !== '' ? Math.min(offset - start, para.len) : 0)
    }
    acc = end + 1 // + le « \n »
  }
  const last = paragraphs[paragraphs.length - 1]
  return last ? last.textStart + last.len : null
}

// Surligne le segment source [offset, offset+len] et défile jusqu'à lui.
function highlightCitation(offset: number, len: number) {
  const view = editor.value?.view
  const content = currentSource.value?.content
  if (!view || !content || offset < 0) return

  const from = offsetToPos(content, offset)
  const to = offsetToPos(content, offset + Math.max(len, 1))
  if (from == null || to == null || to <= from) {
    view.dispatch(view.state.tr.setMeta(sourceHighlightKey, { type: 'clear' }))
    return
  }

  view.dispatch(view.state.tr.setMeta(sourceHighlightKey, { type: 'set', from, to }))
  const dom = view.domAtPos(from).node as HTMLElement
  const el = dom?.nodeType === 1 ? dom : dom?.parentElement
  el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

// Déclenche le surlignage si la demande concerne la source affichée.
function maybeHighlight() {
  if (sourceHighlight.sourceId && sourceHighlight.sourceId === route.params.id) {
    nextTick(() => highlightCitation(sourceHighlight.offset, sourceHighlight.len))
  }
}

onMounted(maybeHighlight)
watch(() => sourceHighlight.nonce, maybeHighlight)
</script>

<template>
  <div class="source-editor bg-base-100 border-r border-base-300 overflow-y-auto">
    <header
      class="sticky top-0 z-10 flex items-center gap-2 px-6 h-14 border-b border-base-300 bg-base-100/90 backdrop-blur"
    >
      <span class="icon-[tabler--file-text] size-5 text-primary"></span>
      <h2 class="text-base font-semibold tracking-tight">Source</h2>
      <div class="ml-auto flex items-center gap-1">
        <button @click="save" class="btn btn-primary btn-sm">
          <span class="icon-[tabler--device-floppy] size-4"></span> Save
        </button>
        <button
          v-if="route.name === 'source'"
          @click="deleteSource"
          class="btn btn-ghost btn-sm btn-square"
          title="Delete source"
        >
          <span class="icon-[tabler--trash] size-4"></span>
        </button>
        <RouterLink
          :to="{ name: 'home' }"
          class="btn btn-ghost btn-sm btn-square"
          title="Close"
        >
          <span class="icon-[tabler--x] size-4"></span>
        </RouterLink>
      </div>
    </header>

    <editor-content :editor="editor" />
  </div>
</template>

<style>
@reference "../assets/main.css";

/* Éditeur de SOURCES : volontairement distinct de l'article — sans-serif,
   compact, allure « notes / référence » plutôt que mise en page éditoriale. */
.source-editor .ProseMirror {
  @apply font-sans text-sm/relaxed text-base-content/90 px-6 py-5 whitespace-break-spaces wrap-break-word break-normal;
}

.source-editor .ProseMirror:focus {
  @apply outline-none;
}

.source-editor .ProseMirror > * + * {
  @apply mt-2;
}

.source-editor .ProseMirror h1 {
  @apply font-sans text-lg font-semibold tracking-tight text-base-content mb-3;
}

.source-editor .ProseMirror .is-empty::before {
  content: attr(data-placeholder);
  @apply float-left text-base-content/30 pointer-events-none h-0;
}

/* Segment source à l'origine d'un passage IA (surlignage transitoire au clic). */
.source-editor .ProseMirror .source-hit {
  background-color: color-mix(in oklab, var(--color-primary) 22%, transparent);
  border-radius: 3px;
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 22%, transparent);
}
</style>
