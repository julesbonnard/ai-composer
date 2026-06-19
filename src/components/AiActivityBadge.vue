<script setup lang="ts">
import { computed } from 'vue'
import { aiActivity } from '../plugins/ai/activity'

// Retour visuel discret de l'usage IA : moteur (cloud Gateway / local navigateur),
// modèle, et tokens entrée/sortie. Magenta (couleur signature IA) quand une
// génération est en cours, estompé au repos avec la dernière mesure. Masqué tant
// qu'aucun appel n'a eu lieu.

// Affiche seulement le segment final du slug de modèle (google/gemini-… → gemini-…).
const modelLabel = computed(() => {
  const m = aiActivity.model
  return m.includes('/') ? m.slice(m.lastIndexOf('/') + 1) : m
})

const visible = computed(() => aiActivity.active || aiActivity.mode !== null)
const usage = computed(() => aiActivity.usage)

// Coût cumulé estimé de la session (appels cloud uniquement ; tarifs indicatifs).
const sessionCost = computed(() => aiActivity.sessionCost)
function fmtCost(c: number): string {
  if (c >= 1) return `$${c.toFixed(2)}`
  if (c >= 0.01) return `$${c.toFixed(3)}`
  return `$${c.toFixed(4)}`
}
</script>

<template>
  <Transition name="ai-badge">
    <div
      v-if="visible"
      class="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-base-300 bg-base-100/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-sm transition-colors"
      :class="aiActivity.active ? 'text-primary' : 'text-base-content/55'"
      :title="
        (aiActivity.mode === 'local' ? 'Local (in-browser)' : 'Cloud (Vercel AI Gateway)') +
        ' · ' +
        aiActivity.model
      "
    >
      <!-- Spinner pendant la génération, sinon icône fixe du moteur -->
      <span
        v-if="aiActivity.active"
        class="icon-[tabler--loader-2] size-3.5 shrink-0 animate-spin"
      ></span>
      <span
        v-else
        class="size-3.5 shrink-0"
        :class="aiActivity.mode === 'local' ? 'icon-[tabler--cpu]' : 'icon-[tabler--cloud]'"
      ></span>

      <span class="font-medium">{{ aiActivity.mode === 'local' ? 'Local' : 'Cloud' }}</span>
      <span class="max-w-[12rem] truncate font-mono text-[11px] opacity-70">{{ modelLabel }}</span>

      <span v-if="usage" class="flex items-center gap-1.5 tabular-nums opacity-80">
        <span class="border-l border-current/20 pl-1.5">↑ {{ usage.inputTokens ?? '–' }}</span>
        <span v-if="usage.outputTokens != null">↓ {{ usage.outputTokens }}</span>
      </span>

      <span
        v-if="sessionCost > 0"
        class="border-l border-current/20 pl-1.5 tabular-nums opacity-80"
        title="Coût cumulé estimé de la session (appels cloud, tarifs indicatifs)"
        >~{{ fmtCost(sessionCost) }}</span
      >
    </div>
  </Transition>
</template>

<style scoped>
.ai-badge-enter-active,
.ai-badge-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.ai-badge-enter-from,
.ai-badge-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
