<script setup lang="ts">
const props = defineProps<{
  modelValue?: object
  autocompletion: (draftBeforeCursor: string, paragraph: string) => Promise<any>
  shorten: (text: string) => Promise<string>
  alternative: (text: string) => Promise<string>
  cancel: () => void
}>()

const emits = defineEmits(['update:modelValue'])

import { ref, computed, watch } from 'vue'
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
import EditorialLinter from '../plugins/EditorialLinter'
import {
  lintDoc,
  buildDispatch,
  positionSemantic,
  type PositionedDiagnostic
} from '../plugins/editorial/proseMirror'
import { runEditorialAgent } from '../plugins/editorial/agent'
import type { DispatchType } from 'stylecheck'
import AiActivityBadge from './AiActivityBadge.vue'

const Article = Document.extend({
  content: 'headline lead (paragraph|heading)*'
})

const wordCount = ref(0)

// --- Linter éditorial (stylecheck) -----------------------------------------
// Métadonnées de la dépêche (type/langue) : pilotent le pré-filtrage par scope.
const dispatchType = ref<DispatchType>('pg')
const lang = ref('fr')
const currentMeta = () => ({ type: dispatchType.value, lang: lang.value })

// Liste des diagnostics positionnés, alimentant le panneau « Problèmes ».
const diagnostics = ref<PositionedDiagnostic[]>([])
const panelOpen = ref(true)
const SEVERITY_META = {
  blocking: { label: 'Bloquant', icon: 'icon-[tabler--ban]' },
  warning: { label: 'Avertissement', icon: 'icon-[tabler--alert-triangle]' },
  suggestion: { label: 'Suggestion', icon: 'icon-[tabler--bulb]' }
} as const

const DISPATCH_TYPES: { value: DispatchType; label: string }[] = [
  { value: 'flash', label: 'Flash' },
  { value: 'alerte', label: 'Alerte' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'lead', label: 'Lead' },
  { value: 'pg', label: 'Papier général' },
  { value: 'factuel', label: 'Factuel court' }
]

function refreshDiagnostics() {
  const doc = editor.value?.state.doc
  diagnostics.value = doc ? lintDoc(doc, currentMeta()).diagnostics : []
}

// --- Couche sémantique (agent IA, À LA DEMANDE) ----------------------------
// Déclenchée manuellement (bouton), jamais à la frappe. Le résultat est un
// instantané : toute édition l'efface (le déterministe reste, lui, live).
const semanticDiagnostics = ref<PositionedDiagnostic[]>([])
const aiLoading = ref(false)
const aiError = ref('')
let aiRunToken = 0

const SEVERITY_RANK = { blocking: 0, warning: 1, suggestion: 2 } as const
// Panneau = déterministe + sémantique, triés par gravité.
const allDiagnostics = computed(() =>
  [...diagnostics.value, ...semanticDiagnostics.value].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )
)

async function runAiLint() {
  const ed = editor.value
  if (!ed || aiLoading.value) return
  aiError.value = ''
  aiLoading.value = true
  const runId = ++aiRunToken
  const { dispatch, blocks } = buildDispatch(ed.state.doc, currentMeta())
  try {
    const diags = await runEditorialAgent(dispatch)
    if (runId !== aiRunToken) return // doc modifié ou relancé entre-temps
    const positioned = positionSemantic(diags, blocks, dispatch)
    semanticDiagnostics.value = positioned
    ed.commands.setSemanticDiagnostics(positioned)
  } catch (e) {
    if (runId === aiRunToken) aiError.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (runId === aiRunToken) aiLoading.value = false
  }
}

// Invalide l'instantané IA dès que le doc change (édition).
function clearSemantic() {
  aiRunToken++
  aiLoading.value = false
  if (semanticDiagnostics.value.length) semanticDiagnostics.value = []
}

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
    EditorialLinter.configure({
      getMeta: currentMeta
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
    refreshDiagnostics()
    clearSemantic() // l'analyse IA (instantané) devient caduque dès qu'on édite
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
    refreshDiagnostics()
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

// Re-lint quand les métadonnées changent (le scope des règles en dépend).
watch([dispatchType, lang], () => {
  editor.value?.commands.refreshLint()
  refreshDiagnostics()
  // Le scope a changé → l'analyse IA précédente n'est plus valable.
  editor.value?.commands.clearSemanticDiagnostics()
  clearSemantic()
})

// Panneau « Problèmes » : révéler un diagnostic dans l'éditeur (sélection + scroll).
function revealDiagnostic(diag: PositionedDiagnostic) {
  editor.value
    ?.chain()
    .focus()
    .setTextSelection({ from: diag.from, to: diag.to })
    .scrollIntoView()
    .run()
}

// Lien vers la page du stylebook d'où vient la règle (déterministe ou sémantique).
const STYLEBOOK_BASE = 'https://stylebook.afp.com/'
function stylebookRef(diag: PositionedDiagnostic): string {
  return diag.source?.page ?? diag.citation?.ref ?? ''
}
function stylebookUrl(diag: PositionedDiagnostic): string | null {
  const ref = stylebookRef(diag)
  if (!ref) return null
  return STYLEBOOK_BASE + ref.split('#')[0] // le fragment (#733) n'est pas une ancre du wiki
}

// Extrait de texte incriminé (tronqué) pour l'affichage dans le panneau.
function diagExcerpt(diag: PositionedDiagnostic): string {
  const text = editor.value?.state.doc.textBetween(diag.from, diag.to, ' ') ?? ''
  return text.length > 70 ? `${text.slice(0, 67)}…` : text
}

// Applique la suggestion (auto-fix façon ESLint) en remplaçant le passage incriminé.
function fixDiagnostic(diag: PositionedDiagnostic) {
  if (!diag.suggestion) return
  editor.value
    ?.chain()
    .focus()
    .insertContentAt({ from: diag.from, to: diag.to }, diag.suggestion)
    .run()
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
  <div class="flex h-full min-h-0">
    <!-- Colonne ÉDITEUR : scroll indépendant, jamais recouvert par le panneau -->
    <section class="relative flex-1 min-w-0 overflow-y-auto">
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
    </section>

    <!-- Rail de réouverture quand le panneau est fermé (n'empiète pas sur le texte) -->
    <button
      v-if="!panelOpen"
      class="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-base-300 bg-base-200/60 py-3 hover:bg-base-200"
      title="Ouvrir le panneau des problèmes éditoriaux"
      @click="panelOpen = true"
    >
      <span class="icon-[tabler--layout-sidebar-right-expand] size-4 text-base-content/60"></span>
      <span v-if="allDiagnostics.length" class="badge badge-xs badge-warning">{{ allDiagnostics.length }}</span>
    </button>

    <!-- Colonne PANNEAU « Problèmes » : ouvrable/repliable comme le lecteur de sources -->
    <aside
      v-if="panelOpen"
      class="flex w-96 shrink-0 flex-col border-l border-base-300 bg-base-100"
    >
    <header class="flex items-center gap-2 border-b border-base-300 px-3 py-2">
      <span class="icon-[tabler--list-check] size-4 text-primary"></span>
      <span class="text-sm font-semibold">Problèmes</span>
      <span class="badge badge-sm" :class="allDiagnostics.length ? 'badge-warning' : 'badge-ghost'">
        {{ allDiagnostics.length }}
      </span>
      <select v-model="dispatchType" class="select select-xs ml-auto w-32" title="Type de dépêche">
        <option v-for="t in DISPATCH_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <button class="btn btn-xs btn-ghost btn-square" title="Fermer" @click="panelOpen = false">
        <span class="icon-[tabler--x] size-4"></span>
      </button>
    </header>

    <!-- Déclenchement MANUEL de l'analyse sémantique (juge IA) — jamais à la frappe. -->
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-2">
      <button
        class="btn btn-xs btn-primary flex-1 gap-1.5"
        :disabled="aiLoading"
        title="Lance le juge éditorial (couche sémantique) sur le texte courant"
        @click="runAiLint"
      >
        <span
          class="size-3.5"
          :class="aiLoading ? 'icon-[tabler--loader-2] animate-spin' : 'icon-[tabler--sparkles]'"
        ></span>
        {{ aiLoading ? 'Analyse…' : 'Analyser (IA)' }}
      </button>
      <span
        v-if="semanticDiagnostics.length"
        class="badge badge-xs badge-soft badge-primary"
        title="Diagnostics IA de la dernière analyse"
      >
        {{ semanticDiagnostics.length }} IA
      </span>
    </div>
    <p v-if="aiError" class="border-b border-base-300 px-3 py-1.5 text-[11px] text-error">
      {{ aiError }}
    </p>

    <div class="flex-1 overflow-y-auto p-2">
      <p v-if="!allDiagnostics.length" class="px-2 py-6 text-center text-sm text-base-content/50">
        Aucun problème détecté ✨
      </p>
      <ul v-else class="flex flex-col gap-1">
        <li
          v-for="(diag, i) in allDiagnostics"
          :key="i"
          class="group cursor-pointer rounded-field border border-transparent p-2 hover:border-base-300 hover:bg-base-200/60"
          @click="revealDiagnostic(diag)"
        >
          <div class="flex items-center gap-1.5">
            <span
              class="size-4 shrink-0"
              :class="[
                SEVERITY_META[diag.severity].icon,
                diag.severity === 'blocking'
                  ? 'text-error'
                  : diag.severity === 'warning'
                    ? 'text-warning'
                    : 'text-info'
              ]"
            ></span>
            <span class="font-mono text-[11px] text-base-content/50">{{ diag.ruleId }}</span>
            <span
              v-if="diag.family === 'semantic'"
              class="badge badge-xs badge-soft badge-primary ml-auto gap-1"
              title="Diagnostic sémantique (juge IA) — advisory"
            >
              <span class="icon-[tabler--sparkles] size-3"></span> IA
            </span>
          </div>
          <p class="mt-0.5 text-xs leading-snug text-base-content/80">{{ diag.message }}</p>
          <p v-if="diagExcerpt(diag)" class="mt-0.5 truncate text-[11px] italic text-base-content/50">
            « {{ diagExcerpt(diag) }} »
          </p>
          <a
            v-if="stylebookUrl(diag)"
            :href="stylebookUrl(diag)!"
            target="_blank"
            rel="noopener"
            class="mt-0.5 inline-flex items-center gap-1 text-[11px] text-base-content/45 hover:text-primary hover:underline"
            :title="`Ouvrir dans le stylebook : ${stylebookRef(diag)}`"
            @click.stop
          >
            <span class="icon-[tabler--book-2] size-3"></span>
            {{ diag.citation?.title ?? stylebookRef(diag) }}
            <span class="icon-[tabler--external-link] size-3"></span>
          </a>
          <button
            v-if="diag.suggestion"
            class="btn btn-xs btn-primary btn-soft mt-1.5"
            @click.stop="fixDiagnostic(diag)"
          >
            <span class="icon-[tabler--wand] size-3.5"></span>
            Corriger → « {{ diag.suggestion }} »
          </button>
        </li>
      </ul>
    </div>
    </aside>

    <!-- Retour visuel discret de l'usage IA (moteur, modèle, tokens) -->
    <ai-activity-badge />
  </div>
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

/* Diagnostics du linter éditorial (stylecheck) : soulignage ondulé par gravité.
   Le message + la suggestion s'affichent au survol via l'attribut `title` natif. */
.article-editor .ProseMirror .stylecheck-diag {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  cursor: help;
}

.article-editor .ProseMirror .stylecheck-blocking {
  text-decoration-color: var(--color-error);
  background-color: color-mix(in oklab, var(--color-error) 10%, transparent);
}

.article-editor .ProseMirror .stylecheck-warning {
  text-decoration-color: var(--color-warning);
}

.article-editor .ProseMirror .stylecheck-suggestion {
  text-decoration-color: var(--color-info);
}

/* Diagnostics SÉMANTIQUES (juge IA, à la demande) : tireté (vs ondulé du
   déterministe) — distingue visuellement le « advisory » du mécanique. */
.article-editor .ProseMirror .stylecheck-semantic {
  text-decoration-style: dashed;
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
