<script setup lang="ts">
import { useSourcesStore } from '../stores/sources'
import { storeToRefs } from 'pinia'

import { useRoute } from 'vue-router'

const route = useRoute()

const isActive = (id: string | number) => {
  return route.name === 'source' && route.params.id == id
}

const sourcesStore = useSourcesStore()
const { sources } = storeToRefs(sourcesStore)
</script>

<template>
  <ol class="max-w-full break-words">
    <li
      v-for="(source, i) in sources"
      :key="i"
      class="cursor-pointer px-3 py-1 text-sm leading-4 transition-colors duration-150"
      :class="{ 'bg-indigo-50': isActive(source.id) }"
    >
      <router-link
        :to="{ name: 'source', params: { id: source.id } }"
        class="no-underline text-purple-700 hover:underline"
      >
        <span v-if="source.embeddings == false" class="loading loading-spinner loading-sm"></span>
        {{ source.title }}
      </router-link>
    </li>
  </ol>
</template>
