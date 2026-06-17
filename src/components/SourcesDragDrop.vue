<script setup lang="ts">
import { useSourcesStore } from '../stores/sources'
import { useDropzone } from 'vue3-dropzone'
import { useRouter } from 'vue-router'
import * as pdfjsLib from 'pdfjs-dist'

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
    const pdf = await pdfjs!.getDocument({ data: typedarray }).promise
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
    const { id } = await addSource(pdfText, file.name)
    router.push({ name: 'source', params: { id } })
  }
  reader.readAsArrayBuffer(file)
}

const { getRootProps, getInputProps, isDragAccept } = useDropzone({
  onDrop,
  accept: ['application/pdf'],
  multiple: false,
  maxFiles: 1
})
</script>

<template>
  <div
    v-bind="getRootProps()"
    class="p-6 bg-primary text-primary-content rounded-lg cursor-pointer hover:bg-primary-focus transition-colors"
  >
    <input v-bind="getInputProps()" />
    <div class="flex flex-col items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p v-if="isDragAccept" class="text-center font-semibold">Drag a PDF here...</p>
      <p v-else class="text-center">
        <span class="font-semibold">Drop a PDF</span><br />
        <span class="text-sm opacity-90">Study, report, press release...</span>
      </p>
    </div>
  </div>
</template>
