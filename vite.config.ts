import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    // Vite's module preload polyfill calls fetch() on chrome-extension:// URLs,
    // which always fails and loops in extension contexts. Disable it.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        panel: 'panel.html',
      },
    },
  },
})
