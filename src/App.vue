<script setup lang="ts">
import { Analytics } from '@vercel/analytics/vue'
import { computed } from 'vue'
import { useRoute, RouterView } from 'vue-router'

const route = useRoute()

const gridColsClass = computed(() => {
  const isGetStartedVisible = route.name === 'get-started'
  const isSourceEditorVisible = route.name === 'source' || route.name == 'new-source'

  return isGetStartedVisible || isSourceEditorVisible
    ? 'grid-cols-[0.4fr_0.7fr_0.9fr]'
    : 'grid-cols-[0.4fr_0fr_1.6fr]'
})
</script>

<template>
  <Analytics />
  <main class="h-full grid transition-all duration-150" :class="gridColsClass">
    <RouterView />
  </main>
</template>
