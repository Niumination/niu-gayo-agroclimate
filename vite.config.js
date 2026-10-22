import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'offline.html', 'icons/pwa-192.png', 'icons/pwa-512.png', 'icons/pwa-maskable-512.png'],
      manifest: {
        id: '/niu/',
        name: 'Niu — Cuaca & Peringatan Dini Tanah Gayo',
        short_name: 'Niu',
        description: 'Papan cuaca dan peringatan dini untuk sentra kopi Arabika Gayo: hujan, longsor, karat daun, asap, gempa, dan api.',
        theme_color: '#F1E7D8',
        background_color: '#F1E7D8',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'id',
        dir: 'ltr',
        categories: ['weather', 'news', 'utilities'],
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Ringkas hari ini', short_name: 'Ringkas', url: '/', icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }] },
          { name: 'Bahaya aktif', short_name: 'Risiko', url: '/?zona=risiko', icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }] },
          { name: 'Cari sentra', short_name: 'Cari', url: '/?palet=1', icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigationPreload: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Proxy API: network-first, fallback cache saat offline
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fallback langsung Open-Meteo bila proxy tidak terjangkau
            urlPattern: /^https:\/\/(api|ensemble-api)\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openmeteo-cache',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Vite 8 memakai Rolldown; codeSplitting.groups adalah API resmi untuk pemisahan vendor.
    // Pisahkan vendor agar cache lebih baik & tiap berkas lebih kecil (anggaran total gzip tetap berlaku).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5188,
    // Pratinjau Arena merender aplikasi di iframe sandbox (origin 'null');
    // tanpa header CORS seluruh aset diblokir dan halaman tampil kosong.
    cors: true,
    // Terima hanya hostname preview Arena; dibutuhkan saat dev server diakses lewat iframe.
    allowedHosts: ['.e2b.app'],
    // Dev: teruskan /api ke server proxy lokal (node server/index.js, :7455) agar fitur
    // konsensus/BMKG/air-quality tampil tanpa build produksi. Tidak berpengaruh pada build.
    proxy: { '/api': { target: 'http://127.0.0.1:7455', changeOrigin: true } },
  },
  preview: {
    // Izinkan hostname preview Arena untuk build lokal, termasuk port preview saat audit.
    allowedHosts: ['.e2b.app'],
    // Wajib untuk iframe sandbox: aset harus dapat dimuat dari origin opaque.
    cors: true,
    // Pratinjau build statis butuh jalur /api yang sama seperti dev, jika tidak
    // seluruh kartu data akan kosong saat pratinjau diproksi.
    proxy: { '/api': { target: 'http://127.0.0.1:7455', changeOrigin: true } },
  },
})
