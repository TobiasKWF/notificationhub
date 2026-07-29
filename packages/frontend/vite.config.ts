import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const BACKEND_URL = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
const BACKEND_WS  = BACKEND_URL.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  server: {
    port: 5173,
    // Dev proxy: forward /api and /ws to the backend so no CORS issues
    proxy: {
      '/api': {
        target:       BACKEND_URL,
        changeOrigin: true,
        // Preserve the original host header (needed by some Fastify hooks)
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[vite proxy] /api error', err.message));
        },
      },
      '/ws': {
        target:     BACKEND_WS,
        ws:         true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[vite proxy] /ws error', err.message));
        },
      },
    },
  },

  build: {
    // Output into frontend/dist — backend app.ts reads from ../../frontend/dist
    outDir:     'dist',
    emptyOutDir: true,
    sourcemap:  false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          ui:       ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs',
                     '@radix-ui/react-toast', '@radix-ui/react-dropdown-menu'],
          charts:   ['recharts'],
          dateFns:  ['date-fns'],
        },
      },
    },
  },

  // Expose backend URL to the app at build time
  define: {
    __BACKEND_URL__: JSON.stringify(BACKEND_URL),
  },
});
