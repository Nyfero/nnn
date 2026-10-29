import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Le module est servi sous /servers/ (voir proxy/Caddyfile)
export default defineConfig({
  base: '/servers/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['vue'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api/servers': { target: process.env.VITE_SERVERS_API ?? 'http://127.0.0.1:3002', changeOrigin: true },
      '/api/core': { target: process.env.VITE_CORE_API ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
})
