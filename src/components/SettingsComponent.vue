<script setup lang="ts">
import ModelSelector from '../components/ModelSelector.vue'
</script>

<template>
  <div class="bg-white shadow-sm overflow-y-auto">
    <div class="sticky top-0 right-2 z-101 float-right">
      <RouterLink :to="{ name: 'home' }" class="btn btn-neutral btn-xs">Close</RouterLink>
    </div>

    <h1 class="text-2xl font-bold p-8">Settings</h1>
    
    <ModelSelector />
  </div>
</template>
