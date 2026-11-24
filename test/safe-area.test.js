// Guard for GC-43 ("recipe sits high, on the UI line"): full-screen recipe
// overlays must keep their header below the status bar and their bottom
// clear of the home indicator, and the pages that rely on env(safe-area-*)
// must declare viewport-fit=cover, otherwise the inset is always 0.
//
// Usage: node test/safe-area.test.js [ROOT]   (ROOT defaults to ../www)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
const violations = [];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

function checkRules(selector, needle) {
  for (const file of walk(ROOT, [])) {
    const text = fs.readFileSync(file, 'utf8');
    let i = -1;
    while ((i = text.indexOf(selector + '{', i + 1)) !== -1) {
      const rule = text.slice(i, text.indexOf('}', i));
      if (rule.indexOf(needle) === -1) {
        violations.push(path.relative(ROOT, file) + ':' + lineOf(text, i) + ' ' + selector + ' rule lacks ' + needle);
      }
    }
  }
}
checkRules('#recipe-screen-hdr', 'safe-area-inset-top');
checkRules('#recipe-sheet', 'safe-area-inset-bottom');

const overlays = [];
['italy', 'protein'].forEach(function (p) { [2, 4, 6, 8].forEach(function (n) { overlays.push(p + '/game' + n + '.html'); }); });
[2, 4, 6, 8, 10].forEach(function (n) { overlays.push('stem/game' + n + '.html'); });
const needCover = overlays.concat(['free/recipe2_download.html', 'free/email_gate.html', 'italy/game3.html']);
needCover.forEach(function (rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { violations.push(rel + ' is missing'); return; }
  if (!/<meta[^>]*name=["']viewport["'][^>]*viewport-fit=cover/i.test(fs.readFileSync(file, 'utf8'))) {
    violations.push(rel + ' viewport meta lacks viewport-fit=cover');
  }
});

if (violations.length) {
  console.error('safe-area: ' + violations.length + ' violation(s)');
  violations.forEach(function (v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('safe-area: OK (' + ROOT + ', ' + needCover.length + ' pages checked for viewport-fit=cover)');
