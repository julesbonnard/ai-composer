import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// stylecheck (linter éditorial) est consommé comme librairie locale depuis le
// repo voisin ~/web/afpstyle/stylecheck — pas de code dupliqué. Alias vers son
// point d'entrée source (HMR conservé) + autorisation d'accès hors racine.
const stylecheckSrc = fileURLToPath(new URL('../afpstyle/stylecheck/src', import.meta.url))

// Build SPA Vite standard. Vercel détecte et déploie nativement le dossier `api/`
// comme fonctions serverless ; les rewrites (fallback SPA) et headers CORS sont
// déclarés dans vercel.json. (vite-plugin-vercel 11 s'est réorienté SSR et n'est
// plus nécessaire ici — cf. ROADMAP.)
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: process.env.PORT as unknown as number,
    fs: {
      // Autorise Vite à servir le source de stylecheck (hors racine du projet).
      allow: ['.', stylecheckSrc],
    },
  },
  resolve: {
    alias: {
      stylecheck: `${stylecheckSrc}/index.ts`,
    },
  },
  plugins: [vue(), tailwindcss()],
  // Pré-bundle transformers.js au démarrage : sinon il est optimisé à la volée quand
  // le Web Worker le charge, ce qui déclenche un reload et une course 404→index.html
  // (erreur vite:import-analysis sur index.html).
  optimizeDeps: {
    include: ['@huggingface/transformers'],
  },
})
