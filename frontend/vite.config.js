import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Enable HTTPS by default for local dev and mobile LAN testing so mobile browsers grant live camera permissions
const enableHttps = process.env.HTTPS === 'true' || process.env.VITE_HTTPS === 'true';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    ...(enableHttps ? [basicSsl()] : []),
  ],
  server: {
    host: true,      // Listen on all network interfaces (0.0.0.0)
    port: 5173,
    https: enableHttps,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

