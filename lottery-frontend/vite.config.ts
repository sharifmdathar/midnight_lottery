import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { resolve } from 'path';


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['crypto', 'stream', 'util', 'process', 'assert', 'vm', 'fs', 'path'],
      globals: {
        Buffer: false,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
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
      '@midnight-ntwrk/onchain-runtime-v2': resolve('node_modules/@midnight-ntwrk/onchain-runtime-v2/midnight_onchain_runtime_wasm.js'),
      '@midnight-ntwrk/ledger-v7': resolve('node_modules/@midnight-ntwrk/ledger-v7/midnight_ledger_wasm.js'),
      '@midnight-ntwrk/zswap': resolve('node_modules/@midnight-ntwrk/zswap/midnight_zswap_wasm.js'),
      'vite-plugin-node-polyfills/shims/buffer': 'buffer',
      'vite-plugin-node-polyfills/shims/process': 'process',
      'vite-plugin-node-polyfills/shims/stream': 'stream-browserify',
      'vite-plugin-node-polyfills/shims/util': 'util',
      'vite-plugin-node-polyfills/shims/assert': 'assert',
      'vite-plugin-node-polyfills/shims/events': 'events',
      stream: 'stream-browserify',
      util: 'util',
      assert: 'assert',
      events: 'events',
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
