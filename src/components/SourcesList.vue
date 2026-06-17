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

const handleCheckboxChange = (sourceId: string) => {
  sourcesStore.toggleSourceActive(sourceId)
}
</script>

<template>
  <ol class="max-w-full wrap-break-word">
    <li
      v-for="(source, i) in sources"
      :key="i"
      class="px-3 py-1 text-sm leading-4 transition-colors duration-150 flex items-center gap-2"
      :class="{ 'bg-indigo-50': isActive(source.id) }"
    >
      <input
        type="checkbox"
        :checked="source.active"
        @change="handleCheckboxChange(source.id)"
        class="checkbox checkbox-sm checkbox-primary"
        :title="source.active ? 'Désactiver cette source' : 'Activer cette source'"
      />
      <router-link
        :to="{ name: 'source', params: { id: source.id } }"
        class="no-underline text-purple-700 hover:underline flex-1 cursor-pointer"
      >
        <span v-if="source.embeddings == false" class="loading loading-spinner loading-sm"></span>
        {{ source.title }}
      </router-link>
    </li>
  </ol>
</template>
