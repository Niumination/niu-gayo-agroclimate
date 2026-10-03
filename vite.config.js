import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/agroclimate/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Niu Gayo Agro-Climate',
        short_name: 'Gayo Agro',
        description: 'Dashboard cuaca pertanian kopi Arabika Gayo & peringatan dini bencana Aceh Tengah',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/agroclimate/',
        lang: 'id',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/agroclimate/index.html',
      },
    }),
  ],
  server: { port: 5188 },
})
