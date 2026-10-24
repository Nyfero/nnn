import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Le module est servi sous /passwords/ (voir proxy/Caddyfile)
export default defineConfig({
  base: '/passwords/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['vue'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api/passwords': { target: process.env.VITE_PASSWORDS_API ?? 'http://127.0.0.1:3001', changeOrigin: true },
      '/api/core': { target: process.env.VITE_CORE_API ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
})
