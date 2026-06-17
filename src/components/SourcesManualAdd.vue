<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function newSource() {
  router.push({ name: 'new-source' })
}
</script>

<template>
  <div
    @click="newSource"
    class="p-6 bg-primary text-primary-content rounded-lg cursor-pointer hover:bg-primary-focus transition-colors"
  >
    <div class="flex flex-col items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      <p class="text-center">
        <span class="font-semibold">Manually add a new source</span><br />
        <span class="text-sm opacity-90">Notes, interview transcript...</span>
      </p>
    </div>
  </div>
</template>
