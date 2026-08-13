import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    fs: {
      allow: ['/Users/sa40091223/Downloads/SatyXAlka',
        'C:/Users/medha/OneDrive/Desktop/WORK/blinkiefash'],
    },
  },
})
