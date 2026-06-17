<script setup lang="ts">
import { computed } from 'vue'
import { localModelState } from '../plugins/ai/engines/loading'

// Liste des fichiers en cours de téléchargement (modèle local transformers.js).
const files = computed(() => Object.values(localModelState.files))

// Progression globale = moyenne des fichiers suivis.
const overall = computed(() => {
  if (files.value.length === 0) return 0
  const sum = files.value.reduce((acc, f) => acc + f.progress, 0)
  return Math.round(sum / files.value.length)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="localModelState.loading"
      class="fixed bottom-4 right-4 z-[200] w-80 card bg-base-100 shadow-xl border border-base-300"
    >
      <div class="card-body p-4 gap-2">
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner loading-sm text-primary"></span>
          <span class="text-sm font-semibold">Loading local model</span>
          <span class="ml-auto text-xs opacity-60">{{ overall }}%</span>
        </div>
        <p class="text-xs opacity-70 truncate" :title="localModelState.modelId">
          {{ localModelState.modelId }}
        </p>

        <progress class="progress progress-primary w-full" :value="overall" max="100"></progress>

        <ul class="mt-1 space-y-1 max-h-32 overflow-y-auto">
          <li v-for="file in files" :key="file.name" class="text-xs">
            <div class="flex justify-between gap-2">
              <span class="truncate opacity-70" :title="file.name">{{ file.name }}</span>
              <span class="opacity-50 shrink-0">{{ file.progress }}%</span>
            </div>
          </li>
        </ul>

        <p class="text-[11px] opacity-50 mt-1">
          The model runs entirely in your browser — sources stay on your device.
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
