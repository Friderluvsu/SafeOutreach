import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Оставляем эти библиотеки внешними, чтобы Node.js загружал их напрямую
        external: ['nodemailer', 'socks', 'better-sqlite3', 'imapflow']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      tailwindcss() 
    ],
    server: {
      host: '127.0.0.1',
      port: 5173
    }
  }
})