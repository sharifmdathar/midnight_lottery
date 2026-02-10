import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
  ],
  define: {
    'global': 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['object-inspect', 'buffer'], // Force pre-bundling of CommonJS modules
    exclude: [
      '@midnight-ntwrk/lottery-contract',
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/ledger-v7',
    ],
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true, // Handle mixed CommonJS/ESM modules
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
