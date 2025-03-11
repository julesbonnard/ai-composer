import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useEditorStore = defineStore('editor', () => {
  const previousArticle = localStorage.getItem('article')
  const defaultArticle = {"type":"doc","content":[{"type":"headline","attrs":{"level":1}},{"type":"lead"}, {"type": "paragraph"}]}
  const article = ref(previousArticle ? JSON.parse(previousArticle) : defaultArticle)

  watch(article, value => {
    localStorage.setItem('article', JSON.stringify(value))
  })

  function $reset() {
    article.value = defaultArticle
  }

  return { article, $reset }
})

