<script setup lang="ts">
import ModelSelector from '../components/ModelSelector.vue'
</script>

<template>
  <div class="bg-base-100 border-r border-base-300 overflow-y-auto">
    <header
      class="sticky top-0 z-10 flex items-center gap-2 px-6 h-14 border-b border-base-300 bg-base-100/90 backdrop-blur"
    >
      <span class="icon-[tabler--settings] size-5 text-primary"></span>
      <h1 class="text-base font-semibold tracking-tight">Settings</h1>
      <RouterLink
        :to="{ name: 'home' }"
        class="btn btn-ghost btn-sm btn-square ml-auto"
        title="Close"
      >
        <span class="icon-[tabler--x] size-4"></span>
      </RouterLink>
    </header>

    <ModelSelector />
  </div>
</template>
