import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// VITE_STATIC=1 builds the GitHub Pages version: relative paths, search logic bundled in-browser (demo data).
const isStatic = process.env.VITE_STATIC === '1';

export default defineConfig({
  base: isStatic ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app changes don't invalidate React/Radix in the browser cache.
        manualChunks: { react: ['react', 'react-dom', 'react-dom/client'], ui: ['radix-ui', 'cmdk', 'sonner', 'next-themes', 'lucide-react'] },
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:3000', '/healthz': 'http://localhost:3000' } },
});
