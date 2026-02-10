import { Buffer } from 'buffer';

// Polyfill Buffer for browser environment
window.Buffer = Buffer;
globalThis.Buffer = Buffer;
