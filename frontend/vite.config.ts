import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 부스 시연용 Cloudflare Quick Tunnel 주소 허용
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
