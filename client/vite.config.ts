import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dir = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(dir, '../shared/index.ts'),
      '@': path.resolve(dir, 'src'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(dir, '..')] },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { outDir: 'dist', target: 'es2022' },
})
