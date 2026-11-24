// Guard for the in-app viewer (assets/pdf-viewer.js): "back" tapped while the
// native PDF is still opening must not leave the PDF open behind the page.
// The native close has to be sent only after the native open has finished.
//
// Usage: node test/pdf-viewer-race.test.js [PATH_TO_pdf-viewer.js]
// Zero dependencies (a tiny fake DOM in a vm sandbox). Exit code 1 on failure.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'assets', 'pdf-viewer.js'));
const code = fs.readFileSync(file, 'utf8');

function fakeEl(id) {
  const cls = new Set();
  return {
    id, style: {}, textContent: '', innerHTML: '', src: '',
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    setAttribute() {}, removeAttribute() {}, appendChild() {}, addEventListener(t, f) { (this.l = this.l || {})[t] = f; },
    getBoundingClientRect: () => ({ bottom: 60 }),
    querySelector(sel) { return (els[sel] = els[sel] || fakeEl(sel)); },
  };
}
const els = {};
const events = [];
let resolveOpen;

const docEl = fakeEl('html');
const document = {
  documentElement: docEl, head: fakeEl('head'), body: fakeEl('body'),
  createElement: () => fakeEl('created'),
  addEventListener() {},
};
const pdfPlugin = {
  addListener() {},
  open() { events.push('open-called'); return new Promise((r) => { resolveOpen = () => { events.push('open-resolved'); r(); }; }); },
  close() { events.push('close-called'); return Promise.resolve(); },
};
const sandbox = {
  document, console, setTimeout, clearTimeout, Promise,
  window: { Capacitor: { isNativePlatform: () => true, Plugins: { PdfViewer: pdfPlugin } }, innerHeight: 800 },
  fetch: () => Promise.resolve({ blob: () => Promise.resolve({}) }),
  FileReader: function () { this.readAsDataURL = () => { this.result = 'data:application/pdf;base64,AAAA'; this.onload(); }; },
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const tick = () => new Promise((r) => setTimeout(r, 5));

(async () => {
  sandbox.window.openPdfViewer('/assets/x.pdf', 'x.pdf');
  for (let i = 0; i < 50 && !events.includes('open-called'); i++) await tick();
  if (!events.includes('open-called')) throw new Error('native open was never called');

  // User taps "back" while the native open is still pending.
  const root = els['#pv'] || null; // root is created with createElement, back button via querySelector
  els['#pv-back'].l.click();
  await tick(); await tick();
  const closedTooEarly = events.includes('close-called');
  resolveOpen();
  for (let i = 0; i < 50 && !events.includes('close-called'); i++) await tick();

  const problems = [];
  if (closedTooEarly) problems.push('native close was sent while the native open was still pending (PDF can stay open behind the page)');
  if (!events.includes('close-called')) problems.push('native close was never sent after the open finished');
  if (events.indexOf('close-called') < events.indexOf('open-resolved')) problems.push('close came before open-resolved: ' + events.join(' > '));
  if (docEl.classList.contains('pv-native')) problems.push('page is still in native mode after back');

  if (problems.length) { console.error('FAIL pdf-viewer-race:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('pdf-viewer-race OK: ' + events.join(' > '));
})().catch((e) => { console.error('FAIL pdf-viewer-race: ' + e.message); process.exit(1); });
