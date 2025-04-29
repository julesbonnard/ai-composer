<script setup lang="ts">
import { useSourcesStore } from '@/stores/sources'
import { useDropzone } from 'vue3-dropzone'
import { useRouter } from 'vue-router'
import type * as pdfjsLib from 'pdfjs-dist'

const sourcesStore = useSourcesStore()
const { addSource } = sourcesStore

const router = useRouter()

let pdfjs: typeof pdfjsLib | undefined
async function loadPDFReader() {
  if (pdfjs) return
  pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
}

async function onDrop(acceptFiles: any[]) {
  if (acceptFiles.length == 0) return
  const file = acceptFiles[0]
  const reader = new FileReader()
  reader.onload = async () => {
    const typedarray = new Uint8Array(reader.result as ArrayBuffer)
    await loadPDFReader()
    const pdf = await pdfjs!.getDocument(typedarray).promise
    const pageCount = pdf.numPages
    let pdfText = ''
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const pageText = await page.getTextContent()

      let lastItemStr = ''
      pageText.items.forEach((item) => {
        if ('str' in item === false) return
        pdfText += item.str
        if (item.hasEOL) {
          if (lastItemStr.endsWith('.')) {
            pdfText += '\n'
          } else {
            pdfText += ' '
          }
        }
        lastItemStr = item.str
      })
    }
    await addSource(pdfText, file.name)
  }
  reader.readAsArrayBuffer(file)
}

const { getRootProps, getInputProps, isDragAccept } = useDropzone({
  onDrop,
  accept: ['application/pdf'],
  multiple: false,
  maxFiles: 1,
  noClick: true
})

function newSource() {
  router.push({ name: 'new-source' })
}
</script>

<template>
  <form class="mt-8 mx-3 mb-3">
    <div
      v-bind="getRootProps()"
      class="p-6 bg-primary text-primary-content rounded-lg cursor-pointer"
    >
      <input v-bind="getInputProps()" />
      <p v-if="isDragAccept">Drop the PDFs here ...</p>
      <p v-else @click="newSource">Drag 'n' drop some PDFs here, or click to add a new source</p>
    </div>
  </form>
</template>
