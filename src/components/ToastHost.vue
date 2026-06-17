<script setup lang="ts">
import { useToasts } from '../composables/useToasts'

// Affiche la pile de toasts. Monté une seule fois dans App.vue. Positionné en bas
// à gauche pour ne pas recouvrir le badge d'activité IA (bas à droite).
const { toasts, dismissToast } = useToasts()

const kindClass: Record<string, string> = {
  error: 'alert-error',
  success: 'alert-success',
  info: 'alert-info',
  warning: 'alert-warning'
}

const kindIcon: Record<string, string> = {
  error: 'icon-[tabler--alert-circle]',
  success: 'icon-[tabler--circle-check]',
  info: 'icon-[tabler--info-circle]',
  warning: 'icon-[tabler--alert-triangle]'
}
</script>

<template>
  <div class="toast toast-start toast-bottom z-[100]">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        role="alert"
        class="alert max-w-sm items-start shadow-lg"
        :class="kindClass[t.kind]"
      >
        <span class="size-5 shrink-0" :class="kindIcon[t.kind]"></span>
        <div class="min-w-0 text-left">
          <p v-if="t.title" class="text-sm font-semibold leading-tight">{{ t.title }}</p>
          <p class="text-sm leading-snug break-words">{{ t.message }}</p>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-square shrink-0"
          aria-label="Dismiss"
          @click="dismissToast(t.id)"
        >
          <span class="icon-[tabler--x] size-4"></span>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-1rem);
}
</style>
