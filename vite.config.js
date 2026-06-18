import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El repo en GitHub Pages se sirve bajo /forge/.
// En dev usamos '/'. Se puede sobreescribir con VITE_BASE.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/forge/' : '/'),
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}))
