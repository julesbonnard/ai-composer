import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vercel from 'vite-plugin-vercel/vite'
// import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: process.env.PORT as unknown as number,
  },
  plugins: [
    vue(),
    tailwindcss(),
    vercel({
      rewrites: [
        {
          source: '/(.*)',
          destination: '/index.html',
        },
      ],
      headers: [
        {
          source: '/api/(.*)',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: 'https://ai-composer.vercel.app' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
            { key: 'Access-Control-Allow-Credentials', value: 'true' },
          ],
        },
      ],
    }),
    // nodePolyfills(),
  ],
})
