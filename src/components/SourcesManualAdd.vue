<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function newSource() {
  router.push({ name: 'new-source' })
}
</script>

<template>
  <button
    type="button"
    @click="newSource"
    class="flex w-full items-center gap-3 p-4 rounded-box border border-base-300 bg-base-100 text-left cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-field bg-primary/10 text-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </span>
    <span>
      <span class="block font-semibold">Add a source manually</span>
      <span class="block text-sm text-base-content/60">Notes, interview transcript…</span>
    </span>
  </button>
</template>
