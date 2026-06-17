import { useStorage } from '@vueuse/core'
import { effectScope, watch } from 'vue'

export type ThemePreference = 'auto' | 'light' | 'dark'

const THEME_LIGHT = 'aicomposer'
const THEME_DARK = 'aicomposer-dark'

// Préférence persistée. 'auto' = on laisse daisyUI suivre prefers-color-scheme
// (le thème sombre est déclaré prefersdark: true) en retirant l'attribut data-theme.
const preference = useStorage<ThemePreference>('ai-composer-theme', 'auto')

// Scope détaché : applique le thème pour toute la durée de vie de l'app,
// indépendamment du composant qui appelle useTheme().
effectScope(true).run(() => {
  watch(
    preference,
    (value) => {
      const root = document.documentElement
      if (value === 'auto') {
        root.removeAttribute('data-theme')
      } else {
        root.setAttribute('data-theme', value === 'dark' ? THEME_DARK : THEME_LIGHT)
      }
    },
    { immediate: true }
  )
})

export function useTheme() {
  return { preference }
}
