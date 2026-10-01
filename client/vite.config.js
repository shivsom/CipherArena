import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // forward /api requests from the React dev server to the Express API
    proxy: { '/api': 'http://localhost:5000' },
  },
})
