import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  // Load environment variables based on mode (development, production)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    define: {
      'process.env.VITE_PUBLIC_MENU_BASE_URL': JSON.stringify(env.VITE_PUBLIC_MENU_BASE_URL || 'http://localhost:5173'),
      'process.env.VITE_DEMO_MODE': JSON.stringify(env.VITE_DEMO_MODE || ''),
    },
    server: {
      port: 5173,
    },
  }
})
