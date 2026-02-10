import * as processPolyfill from 'process';

globalThis.process = processPolyfill;
window.process = processPolyfill;

export { processPolyfill as process };
export default processPolyfill;
