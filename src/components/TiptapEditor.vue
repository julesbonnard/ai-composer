<script setup lang="ts">
const props = defineProps<{
  modelValue?: object
  autocompletion: (draftBeforeCursor: string, paragraph: string) => Promise<any>
  shorten: (text: string) => Promise<string>
  alternative: (text: string) => Promise<string>
  cancel: () => void
}>()

const emits = defineEmits(['update:modelValue'])

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { requestSourceHighlight, clearSourceHighlight } from '../composables/useSourceHighlight'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import Lead from '../plugins/Lead'
import Headline from '../plugins/Headline'
import Limit from '../plugins/Limit'
import Completion from '../plugins/Completion'
import Autocompletion from '../plugins/Autocompletion'
import AiActivityBadge from './AiActivityBadge.vue'

const Article = Document.extend({
  content: 'headline lead (paragraph|heading)*'
})

const wordCount = ref(0)
// Suivi de la présence du curseur dans un passage IA (transition true→false =
// fermeture du tooltip de revue → clear du surlignage source).
let wasInCompletion = false
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      document: false,
      heading: {
        levels: [2]
      }
    }),
    Article,
    Headline,
    Lead,
    Autocompletion.configure({
      autocompletion: props.autocompletion,
      shorten: props.shorten,
      alternative: props.alternative,
      cancel: props.cancel
    }),
    Completion,
    Limit.configure({
      limits: {
        headline: {
          charCount: 59
        },
        lead: {
          wordCount: 35
        }
      }
    }),
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ node }) => {
        if (node.type.name === 'headline') {
          return 'Write a catchy headline'
        }

        if (node.type.name === 'lead') {
          return 'Tell the story in one lead'
        }

        if (node.type.name === 'heading') {
          return 'Come up with an intertitle'
        }

        return 'Add some further context'
      }
    })
  ],
  onUpdate: ({ editor }) => {
    emits('update:modelValue', editor.getJSON())
    countWords()
  },
  // Quand le curseur quitte un passage IA, le tooltip de revue se ferme : on retire
  // alors le surlignage du segment dans l'éditeur de source (s'il y en avait un).
  onSelectionUpdate: ({ editor }) => {
    const inCompletion = editor.isActive('completion')
    if (wasInCompletion && !inCompletion) clearSourceHighlight()
    wasInCompletion = inCompletion
  },
  onCreate: () => {
    countWords()
  },
  autofocus: true,
  editable: true,
  injectCSS: true
})

function countWords() {
  const nodes = (editor.value?.state.doc.content as any).content

  wordCount.value = nodes
    .filter((_: any, i: number) => i > 0) // Remove title from word count
    .reduce(
      (acc: number, d: Node) =>
        d.textContent ? acc + d.textContent.split(' ').filter((d) => d !== '').length : acc,
      0
    )
}

function reset() {
  editor.value?.commands.clearContent()
}

function exportHTML() {
  return editor.value?.getHTML()
}

defineExpose({ reset, exportHTML })

const wordCountMax = computed(() => {
  if (wordCount.value > 750) return 1100
  if (wordCount.value > 550) return 900
  if (wordCount.value > 350) return 700
  if (wordCount.value > 250) return 500
  return 300
})

// Type structurel minimal (ce qu'on utilise du callback shouldShow de BubbleMenu).
type ShouldShowProps = { editor: { isActive: (name: string) => boolean }; state: EditorState }

// Menu de sélection (shorten/alternative) : uniquement sur une vraie sélection,
// et pas quand on est déjà dans un passage IA (le tooltip de revue prend le relais).
function showSelectionMenu({ editor, state }: ShouldShowProps) {
  return !state.selection.empty && !editor.isActive('completion')
}

// Tooltip de revue : visible dès que le curseur est dans un passage généré par l'IA.
function showCompletionReview({ editor }: ShouldShowProps) {
  return editor.isActive('completion')
}

// Libellé de provenance affiché dans le tooltip (appel direct en template pour
// être réévalué à chaque transaction — un computed ne se rafraîchirait pas).
function completionProvenance() {
  const attrs = editor.value?.getAttributes('completion') ?? {}
  if (attrs['data-kind'] === 'shorten') return 'Shortened from your text'
  if (attrs['data-kind'] === 'alternative') return 'Alternative wording'
  return attrs['data-source'] ? `Source · ${attrs['data-source']}` : 'From your sources'
}

// Marque tout le passage IA comme relu : on étend d'abord la sélection à toute
// l'étendue de la marque (et pas seulement ce qui est sélectionné) avant de la retirer.
function reviewCompletion() {
  editor.value?.chain().focus().extendMarkRange('completion').unsetMark('completion').run()
}

const router = useRouter()

// Un passage « source » avec un id pointe vers une source ouvrable (les passages
// shorten/alternative n'ont pas de source).
function completionSourceId(): string {
  const attrs = editor.value?.getAttributes('completion') ?? {}
  return attrs['data-kind'] === 'source' && attrs['data-id'] ? attrs['data-id'] : ''
}

// Ouvre la source liée et demande le surlignage du segment d'origine.
function openCompletionSource() {
  const attrs = editor.value?.getAttributes('completion') ?? {}
  const id = attrs['data-id']
  if (!id) return
  const offset = attrs['data-offset'] ? parseInt(attrs['data-offset'], 10) : -1
  const len = attrs['data-len'] ? parseInt(attrs['data-len'], 10) : 0
  requestSourceHighlight(id, offset, len)
  router.push({ name: 'source', params: { id } })
}
</script>

<template>
  <div class="sticky top-0 z-50 h-1.5 bg-base-200/80 backdrop-blur-sm overflow-x-hidden"
    :title="`${wordCount} words`">
    <div :style="`width: ${Math.min((wordCount / wordCountMax) * 100, 100)}%`"
      class="h-full bg-primary/60 transition-[width] duration-300 ease-out"></div>
    <div v-for="step in [200, 400, 600, 800]" :key="step"
      class="absolute top-0 h-full border-l border-base-content/15"
      :style="`left: ${(step / wordCountMax) * 100}%`">
      <span class="absolute top-2 left-1 text-[10px] font-medium text-base-content/40 whitespace-nowrap">
        {{ step }}{{ step === 200 ? ' words' : '' }}
      </span>
    </div>
  </div>

  <!-- Sélection de texte : raccourcir / reformuler -->
  <bubble-menu
    v-if="editor"
    :editor="editor"
    plugin-key="selectionMenu"
    :should-show="showSelectionMenu"
    class="join shadow-lg rounded-field overflow-hidden z-10"
  >
    <button class="btn btn-sm btn-neutral join-item" @click="editor.chain().focus().shorten().run()">
      <span class="icon-[tabler--arrows-minimize] size-4"></span> Shorten
    </button>
    <button
      class="btn btn-sm btn-neutral join-item"
      @click="editor.chain().focus().alternative().run()"
    >
      <span class="icon-[tabler--refresh] size-4"></span> Alternative
    </button>
  </bubble-menu>

  <!-- Revue d'un passage généré par l'IA : provenance + acceptation -->
  <bubble-menu
    v-if="editor"
    :editor="editor"
    plugin-key="completionReview"
    :should-show="showCompletionReview"
    :options="{ placement: 'top', offset: 8 }"
    class="z-20"
  >
    <div
      class="flex items-center gap-2.5 rounded-box border border-base-300 bg-base-100 px-3 py-2 shadow-xl"
    >
      <span class="icon-[tabler--sparkles] size-4 shrink-0 text-primary"></span>
      <div class="min-w-0">
        <p class="text-xs font-semibold leading-tight">AI-generated</p>
        <p class="max-w-[16rem] truncate text-xs leading-tight text-base-content/60">
          {{ completionProvenance() }}
        </p>
      </div>
      <button
        v-if="completionSourceId()"
        class="btn btn-xs btn-ghost ml-1 shrink-0"
        title="Open the source and highlight the matching passage"
        @click="openCompletionSource"
      >
        <span class="icon-[tabler--external-link] size-3.5"></span> Source
      </button>
      <button
        class="btn btn-xs btn-primary shrink-0"
        title="Accept this passage and remove the AI highlight"
        @click="reviewCompletion"
      >
        <span class="icon-[tabler--check] size-3.5"></span> Reviewed
      </button>
    </div>
  </bubble-menu>

  <editor-content :editor="editor" spellcheck="true" class="article-editor" />

  <!-- Retour visuel discret de l'usage IA (moteur, modèle, tokens) -->
  <ai-activity-badge />

</template>

<style>
@reference "../assets/main.css";

/* Styles propres à l'éditeur d'ARTICLE (scopés via .article-editor) :
   colonne de lecture centrée, mesure confortable, serif éditoriale.
   L'éditeur de SOURCES a ses propres styles (cf. SourceEditor.vue). */
.article-editor .ProseMirror {
  @apply font-serif text-lg/relaxed text-base-content max-w-[68ch] mx-auto px-6 pt-12 pb-32 whitespace-break-spaces wrap-break-word break-normal;
}

/* Le caret signale le focus : pas d'anneau sur la surface d'écriture elle-même. */
.article-editor .ProseMirror:focus {
  @apply outline-none;
}

.article-editor .ProseMirror > * + * {
  @apply mt-4;
}

.article-editor .ProseMirror h1 {
  @apply font-serif text-[2.6rem]/[1.15] font-semibold tracking-tight text-balance mb-1;
}

.article-editor .ProseMirror h2 {
  @apply font-serif text-2xl/snug font-semibold tracking-tight text-balance mt-8;
}

.article-editor .ProseMirror .lead {
  @apply text-xl/relaxed font-medium text-base-content/80 text-pretty;
}

.article-editor .ProseMirror p {
  @apply text-pretty;
}

.article-editor .ProseMirror .unvalid {
  @apply text-error;
}

.article-editor .ProseMirror strong {
  @apply font-semibold;
}

/* Passages générés par l'IA : marqueur lisible en clair comme en sombre
   (couleurs dérivées des variables de thème, qui s'adaptent automatiquement).
   Curseur de texte inchangé ; la provenance/revue passe par le tooltip interactif. */
.article-editor .ProseMirror .completion {
  border-radius: 3px;
  padding-bottom: 1px;
  background-color: color-mix(in oklab, var(--color-primary) 16%, transparent);
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  transition: background-color 0.15s ease;
}

.article-editor .ProseMirror .completion:hover {
  background-color: color-mix(in oklab, var(--color-primary) 26%, transparent);
}

.article-editor .ProseMirror .is-empty::before {
  content: attr(data-placeholder);
  @apply float-left text-base-content/30 italic pointer-events-none h-0;
}

/* Suggestion fantôme (avant insertion) : dégradé signature dérivé du thème. */
.article-editor .ProseMirror .autocompletion::after,
.article-editor .ProseMirror .autocompletion.inline {
  content: attr(data-autocompletion);
  pointer-events: none;
  background: linear-gradient(95deg, var(--color-primary), var(--color-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
</style>
