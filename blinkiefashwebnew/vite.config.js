import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Extract CSS into separate files instead of bundling into JS
    // This ensures CSS loads before JavaScript renders components
    cssCodeSplit: true,
  },
  server: {
    port: 5175,
  },
})
