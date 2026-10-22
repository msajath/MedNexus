import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.QA_API_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 70,
        lines: 77,
      },
    },
  },
})
