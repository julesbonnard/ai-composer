<script setup lang="ts">
import { ref } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { useRouter } from 'vue-router'
import { fetchNewsContext } from '../plugins/asknews'
import type { SearchResponseDictItem } from '@emergentmethods/asknews-typescript-sdk'

const sourcesStore = useSourcesStore()
const { addSource } = sourcesStore
const router = useRouter()

const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<any[]>([])
const error = ref('')

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    return
  }

  isSearching.value = true
  error.value = ''
  searchResults.value = []

  try {
    const results = await fetchNewsContext(searchQuery.value)
    searchResults.value = results.asDicts || []
    
    if (searchResults.value.length === 0) {
      error.value = 'No results found'
    }
  } catch (err) {
    console.error('Error during search:', err)
    error.value = 'Error during search. Check that server is launched.'
  } finally {
    isSearching.value = false
  }
}

async function addNewsAsSource(article: SearchResponseDictItem) {
  const title = article.title || article.engTitle || 'Untitled article'
  const content = article.summary || ''
  
  if (!content) {
    error.value = 'This story doesn\'t have content'
    return
  }

  const { id } = await addSource(content, `[AskNews] ${title}`)
  router.push({ name: 'source', params: { id } })
}
</script>

<template>
  <div class="p-4 bg-base-200 rounded-lg">
    <h3 class="text-lg font-semibold mb-3">Fetch context from news</h3>
    <form @submit.prevent="handleSearch" class="space-y-3">
      <div class="form-control">
        <div class="join w-full">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search news articles..."
            class="input input-bordered join-item flex-1"
            :disabled="isSearching"
            required
          />
          <button
            type="submit"
            class="btn btn-accent join-item"
            :disabled="isSearching || !searchQuery.trim()"
          >
            <span v-if="isSearching" class="loading loading-spinner loading-sm"></span>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ error }}</span>
      </div>

      <div v-if="searchResults.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="(article, index) in searchResults"
          :key="index"
          class="card bg-base-100 shadow-sm"
        >
          <div class="card-body p-3">
            <h4 class="card-title text-sm">
              {{ article.title || article.headline || 'Sans titre' }}
            </h4>
            <p v-if="article.summary" class="text-xs opacity-70 line-clamp-2">
              {{ article.summary }}
            </p>
            <div class="card-actions justify-end mt-2">
              <button
                type="button"
                @click="addNewsAsSource(article)"
                class="btn btn-xs btn-accent"
              >
                Add as source
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
