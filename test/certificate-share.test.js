// Guard for GC-45: the certificate share/print image must copy the on-screen
// layout (one layout source), not use its own hard-coded fractions of the
// canvas height, which put the photo circle on top of the name and caption.
//
// Usage: node test/certificate-share.test.js [ROOT]   (ROOT defaults to ../www)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
const file = path.join(ROOT, 'assets', 'certificate-share.js');
const text = fs.readFileSync(file, 'utf8');
const violations = [];

text.split('\n').forEach(function (ln, i) {
  if (/\bH\s*\*\s*0?\.\d+/.test(ln)) violations.push('certificate-share.js:' + (i + 1) + ' hard-coded height fraction: ' + ln.trim());
});
if (text.indexOf('getBoundingClientRect') === -1) violations.push('certificate-share.js does not use getBoundingClientRect (layout is not copied from the page)');
['.cert-name', '.cert-photo-wrap', '.cert-achievement'].forEach(function (sel) {
  if (text.indexOf(sel) === -1) violations.push('certificate-share.js does not read ' + sel + ' from the page');
});

if (violations.length) {
  console.error('certificate-share: ' + violations.length + ' violation(s)');
  violations.forEach(function (v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('certificate-share: OK (' + ROOT + ')');
