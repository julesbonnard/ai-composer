<script setup lang="ts">
const props = defineProps<{
  modelValue?: Object
  autocompletion: (text: string) => Promise<any>
  shorten: (text: string) => Promise<AIMessageChunk>
  alternative: (text: string) => Promise<AIMessageChunk>
}>()

const emits = defineEmits(['update:modelValue'])

import { ref, computed } from 'vue'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import Lead from '@/plugins/Lead'
import Headline from '@/plugins/Headline'
import Limit from '@/plugins/Limit'
import Completion from '@/plugins/Completion'
import Autocompletion from '@/plugins/Autocompletion'
import type { AIMessageChunk } from '@langchain/core/messages'

const Article = Document.extend({
  content: 'headline lead (paragraph|heading)*'
})

const wordCount = ref(0)
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
      alternative: props.alternative
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
</script>

<template>
  <div class="sticky top-0 overflow-x-hidden text-right text-xs pr-1 z-50">
    <div :style="`width: ${(wordCount / wordCountMax) * 100}%`" class="h-5 bg-neutral/50"></div>
    <div
      v-for="step in [200, 400, 600, 800]"
      :key="step"
      class="absolute top-0 border-l border-black pl-1 text-neutral-content text-xs"
      :style="`left: ${(step / wordCountMax) * 100}%`"
    >
      {{ step }}{{ step === 200 ? ' words' : '' }}
    </div>
  </div>

  <bubble-menu v-if="editor" :editor="editor" :tippy-options="{ duration: 100 }" class="z-10">
    <button class="btn btn-neutral btn-sm" @click="editor.chain().focus().shorten().run()">
      shorten
    </button>
    <button class="btn btn-neutral btn-sm" @click="editor.chain().focus().alternative().run()">
      alternative
    </button>
    <button
      v-show="editor.isActive('completion')"
      class="btn btn-neutral btn-sm"
      @click="editor.chain().focus().unsetMark('completion').run()"
    >
      review
    </button>
  </bubble-menu>

  <editor-content :editor="editor" spellcheck="true" class="m-5" />
</template>

<style>
@reference "@/assets/main.css";

.ProseMirror {
  @apply p-3 whitespace-break-spaces break-words break-all mt-10 ml-5;
}

.ProseMirror:focus {
  @apply outline-none;
}

.ProseMirror > * + * {
  @apply mt-3;
}

.ProseMirror h1 {
  @apply text-4xl font-semibold;
}

.ProseMirror .lead {
  @apply text-xl font-semibold;
}

.ProseMirror .unvalid {
  @apply text-error;
}

.ProseMirror strong {
  @apply font-semibold;
}

.ProseMirror .completion {
  @apply underline decoration-dotted bg-inherit;
}

.ProseMirror .is-empty::before {
  content: attr(data-placeholder);
  @apply float-left text-neutral/20 pointer-events-none h-0;
}

.ProseMirror .autocompletion::after,
.ProseMirror .autocompletion.inline {
  content: attr(data-autocompletion);
  pointer-events: none;
  background: linear-gradient(
    90.4deg,
    rgba(244, 199, 62, 1) -3.8%,
    rgba(244, 62, 62, 1) 46.8%,
    rgba(245, 61, 195, 1) 98.8%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
</style>
