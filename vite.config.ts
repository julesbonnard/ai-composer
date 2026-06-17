import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Build SPA Vite standard. Vercel détecte et déploie nativement le dossier `api/`
// comme fonctions serverless ; les rewrites (fallback SPA) et headers CORS sont
// déclarés dans vercel.json. (vite-plugin-vercel 11 s'est réorienté SSR et n'est
// plus nécessaire ici — cf. ROADMAP.)
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: process.env.PORT as unknown as number,
  },
  plugins: [vue(), tailwindcss()],
})
