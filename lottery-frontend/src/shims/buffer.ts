import { Buffer as BufferPolyfill } from 'buffer';

globalThis.Buffer = BufferPolyfill;
window.Buffer = BufferPolyfill;

export { BufferPolyfill as Buffer };
export default BufferPolyfill;
