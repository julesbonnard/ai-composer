<script setup lang="ts">
import { useTheme, type ThemePreference } from '../composables/useTheme'

const { preference } = useTheme()

const options: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'auto', icon: 'icon-[tabler--device-desktop]', label: 'Match system theme' },
  { value: 'light', icon: 'icon-[tabler--sun]', label: 'Light theme' },
  { value: 'dark', icon: 'icon-[tabler--moon]', label: 'Dark theme' }
]
</script>

<template>
  <div class="join" role="group" aria-label="Theme">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="btn btn-xs join-item"
      :class="preference === option.value ? 'btn-primary' : 'btn-ghost'"
      :aria-pressed="preference === option.value"
      :title="option.label"
      @click="preference = option.value"
    >
      <span :class="option.icon" class="size-3.5"></span>
    </button>
  </div>
</template>
