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
import type { AIMessageChunk, MessageContent } from '@langchain/core/messages';
import type { DocumentInterface } from '@langchain/core/documents';

const Article = Document.extend({
  content: 'headline lead (paragraph|heading)*',
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

function countWords () {
  const nodes = (editor.value?.state.doc.content as any).content

    wordCount.value = nodes
      .filter((_: any, i: number) => i > 0) // Remove title from word count
      .reduce((acc: number, d: Node) => d.textContent ? acc + d.textContent.split(' ').filter(d => d !== '').length : acc, 0)
}

function reset () {
  editor.value?.commands.clearContent()
}

function exportHTML () {
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
  <div id="progress-container">
    <div id="progress" :style="`width: ${wordCount/wordCountMax*100}%`"></div>
    <div class="bar" :style="`left: ${200/wordCountMax*100}%`">200 words</div>
    <div class="bar" :style="`left: ${400/wordCountMax*100}%`">400</div>
    <div class="bar" :style="`left: ${600/wordCountMax*100}%`">600</div>
    <div class="bar" :style="`left: ${800/wordCountMax*100}%`">800</div>
  </div>
  <bubble-menu
    id="bubble-menu"
    :editor="editor"
    :tippy-options="{ duration: 100 }"
    v-if="editor"
  >
    <button @click="editor.chain().focus().shorten().run()">
      shorten
    </button>
    <button @click="editor.chain().focus().alternative().run()">
      alternative
    </button>
    <button v-show="editor.isActive('completion')" @click="editor.chain().focus().unsetMark('completion').run()">
      review
    </button>
  </bubble-menu>
  <editor-content id="article" :editor="editor" spellcheck="true" />
</template>

<style lang="scss">
#progress-container {
  position: sticky;
  top: 0px;
  width: 100%;
  overflow-x: hidden;
  color: white;
  text-align: right;
  font-size: 0.7rem;
  padding-right: 4px;
  text-shadow: 0px 0px 3px rgba(0, 0, 0, 1);

  #progress {
    background-color: rgba(#8232eb, 0.5);
    height: 1.2rem;
  }

  .bar {
    position: absolute;
    top: 0px;
    border-left: 1px solid black;
    padding-left: 2px;
  }
}

#bubble-menu {
  button {
    border: none;
    background-color: #8232eb;
    padding: 4px 6px;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    &:hover {
      background-color: rgba(#8232eb, 0.6);
    }
  }
}

/* Basic editor styles */
#article {
  .ProseMirror {
    padding: 0.75em;
    white-space: break-spaces;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-size: 1.2rem;
    margin-top: 5em;
    margin-left: 50px;

    &:focus {
      outline: 0px solid transparent;
    }

    > * + * {
      margin-top: 0.75em;
    }

    h1 {
      font-size: 2.4rem;
    }

    .lead {
      font-size: 1.4rem;
    }

    .unvalid {
      background-color: lightpink;
    }

    .lead, strong {
      font-weight: bold;
    }

    .completion {
      text-decoration: underline;
      text-decoration-style: dotted;
      background-color: inherit;
    }
  }

  /* Placeholder (on every new line) */
  .ProseMirror .is-empty::before {
    content: attr(data-placeholder);
    float: left;
    color: #ced4da;
    pointer-events: none;
    height: 0;
  }

  /* Autocompletion (on every new line) */
  .ProseMirror .autocompletion::after {
    content: attr(data-autocompletion);
    pointer-events: none;
    color: transparent;
    background: linear-gradient( 90.4deg,  rgba(244,199,62,1) -3.8%, rgba(244,62,62,1) 46.8%, rgba(245,61,195,1) 98.8% );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .ProseMirror .autocompletion.inline {
    color: transparent;
    background: linear-gradient( 90.4deg,  rgba(244,199,62,1) -3.8%, rgba(244,62,62,1) 46.8%, rgba(245,61,195,1) 98.8% );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

</style>