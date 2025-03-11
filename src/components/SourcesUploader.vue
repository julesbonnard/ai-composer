<script setup lang="ts">
import { useSourcesStore } from '@/stores/sources'
import { useDropzone } from 'vue3-dropzone'
import { useRouter } from 'vue-router'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type * as pdfjsLib from 'pdfjs-dist'

const sourcesStore = useSourcesStore()
const { addSource } = sourcesStore

const router = useRouter()

let pdfjs: typeof pdfjsLib | undefined
async function loadPDFReader () {
  if (pdfjs) return
  pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker?url')
  pdfjs.GlobalWorkerOptions.workerSrc  = worker.default
  
}


async function onDrop(acceptFiles: any[]) {
  if (acceptFiles.length == 0) return
  const file = acceptFiles[0]
  const reader = new FileReader()
  reader.onload = async () => {
    const typedarray = new Uint8Array(reader.result as ArrayBuffer);
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

function newSource () {
  router.push({ name: 'new-source' })
}
</script>

<template>
  <form>
    <div id="dropzone" v-bind="getRootProps()">
      <input v-bind="getInputProps()" />
      <p v-if="isDragAccept">Drop the PDFs here ...</p>
      <p v-else @click="newSource">Drag 'n' drop some PDFs here, or click to add a new source</p>
    </div>
  </form>
</template>

<style lang="scss" scoped>
form {
  margin: 32px 12px 12px 12px;
}
#dropzone {
  width: 100%;
  padding: 24px;
  background-color: #8232eb;
  color: white;
  border-radius: 8px;
  cursor: pointer;
}
textarea {
  width: 100%;
  height: 200px;
  font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;
  border-color: rgb(209 213 219/0.8);
  font-size: .875rem;
  line-height: 1.25rem;
}
input {
  width: 100%;
  border: 1px solid rgb(209 213 219/0.8);
  margin-bottom: 12px;
  outline: none;
}
</style>
