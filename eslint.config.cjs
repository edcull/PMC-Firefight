/* What the linter holds the source to: nothing used that is not defined, and
   no key given twice in one object. (The code is plain ES5-and-a-bit, loaded
   by <script> tags in a browser and by require under Node.) Run by
   test/unit/lint.js as part of `npm test`, whenever eslint can be found. */
const browser = ['window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'screen',
  'visualViewport', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'getComputedStyle', 'matchMedia',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'fetch', 'WebSocket', 'Image', 'URL', 'Blob',
  'FileReader', 'AudioContext', 'webkitAudioContext', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver',
  'HTMLCanvasElement', 'OffscreenCanvas', 'Path2D', 'ImageData', 'DOMMatrix', 'Event', 'CustomEvent', 'KeyboardEvent',
  'PointerEvent', 'DOMParser', 'TextEncoder', 'TextDecoder', 'alert', 'confirm', 'btoa', 'atob', 'crypto'];
const shared = ['console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'structuredClone'];
const node = ['global', 'module', 'require', 'process', 'Buffer', '__dirname'];
const globals = {};
browser.concat(shared, node).forEach((g) => { globals[g] = 'readonly'; });
globals.module = 'writable';
module.exports = [{
  files: ['src/**/*.js', 'server/**/*.js', 'scripts/**/*.js', 'server.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals },
  rules: { 'no-undef': 'error', 'no-dupe-keys': 'error' }
}];
