import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Phase 11 — code-split per route via React.lazy() di App.jsx,
// plus manualChunks below untuk separate engine + vendor dari main bundle.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor — biggest separators
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          // Engine layer (mature, low-churn) — separate chunks
          if (id.includes('/src/lib/roster-engine/')) return 'engine-roster'
          if (id.includes('/src/lib/rolling-engine/')) return 'engine-rolling'
          if (id.includes('/src/lib/ca-engine/')) return 'engine-ca'
          if (id.includes('/src/lib/airport-data/')) return 'engine-airport-data'
        },
      },
    },
  },
})
