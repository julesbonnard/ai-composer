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
      class="group flex items-center gap-2.5 px-4 py-1.5 text-sm leading-snug border-l-2 transition-colors duration-150"
      :class="
        isActive(source.id)
          ? 'border-primary bg-primary/8'
          : 'border-transparent hover:bg-base-100'
      "
    >
      <input
        type="checkbox"
        :checked="source.active"
        @change="handleCheckboxChange(source.id)"
        class="checkbox checkbox-xs checkbox-primary"
        :title="source.active ? 'Disable this source' : 'Enable this source'"
      />
      <router-link
        :to="{ name: 'source', params: { id: source.id } }"
        class="flex-1 cursor-pointer no-underline transition-colors"
        :class="
          source.active
            ? 'text-base-content group-hover:text-primary'
            : 'text-base-content/40 group-hover:text-primary'
        "
      >
        <span
          v-if="source.embeddings == false"
          class="loading loading-spinner loading-xs align-middle"
        ></span>
        {{ source.title }}
      </router-link>
    </li>
  </ol>
</template>
