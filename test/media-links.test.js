// Guard for GC-4 / GC-43 / GC-44: every link or button that opens a PDF or a
// recipe image must go through the in-app viewer (assets/pdf-viewer.js).
// Inside the iOS web view a plain link to a file replaces the whole page with
// no way back, and a blob "download" does nothing.
//
// Usage: node test/media-links.test.js [ROOT]   (ROOT defaults to ../www)
// Zero dependencies. Exit code 1 on any violation.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
const DOWNLOAD_EXEMPT = ['assets/pdf-viewer.js', 'assets/certificate-share.js'];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const violations = [];
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }
function fail(file, line, reason) {
  violations.push(path.relative(ROOT, file) + ':' + line + ' ' + reason);
}

const FILE_ANCHOR = /<a\b[^>]*\bhref\s*=\s*["'][^"']*\.(pdf|jpe?g|png)(\?[^"']*)?(#[^"']*)?["']/gi;
const VIEWER_CALL = /\b(openPdfViewer|openMediaViewer|downloadRecipes)\(/g;
const NAV_TO_FILE = /(location(\.href)?\s*=|window\.open\()\s*[^;]*\.(pdf|jpe?g|png)/;
const NAV_TO_HREF = /location(\.href)?\s*=\s*\w+\.getAttribute\(['"]href/;

for (const file of walk(ROOT, [])) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const isHtml = file.endsWith('.html');

  // (a) a page that links to or opens a file must include the viewer
  if (isHtml && !/pdf-viewer\.js/.test(text)) {
    let m;
    FILE_ANCHOR.lastIndex = 0;
    while ((m = FILE_ANCHOR.exec(text))) fail(file, lineOf(text, m.index), 'link to a PDF/image but pdf-viewer.js is not included');
    VIEWER_CALL.lastIndex = 0;
    while ((m = VIEWER_CALL.exec(text))) fail(file, lineOf(text, m.index), m[1] + '() used but pdf-viewer.js is not included');
  }

  // (b) blob/anchor "download" trick does nothing in the app web view
  if (!DOWNLOAD_EXEMPT.includes(rel)) {
    const re = /\.download\s*=/g; let m;
    while ((m = re.exec(text))) fail(file, lineOf(text, m.index), 'a.download = ... (does nothing in the app); use openMediaViewer');
  }

  text.split('\n').forEach(function (ln, i) {
    // (c) navigation straight to a file replaces the page
    if (NAV_TO_FILE.test(ln)) fail(file, i + 1, 'navigates straight to a PDF/image: ' + ln.trim().slice(0, 90));
    if (ln.indexOf('window.open(this.src') !== -1) fail(file, i + 1, 'window.open(this.src...) opens a bare image');
    if (NAV_TO_HREF.test(ln)) fail(file, i + 1, 'location = <link>.getAttribute("href") is a dead end for files');
    // (d) removed broken helper
    if (ln.indexOf('downloadBooklet') !== -1) fail(file, i + 1, 'downloadBooklet (broken blob download) is back');
  });
}

// (e) the viewer itself must handle images and catch links in the capture
// phase, otherwise parents-page image links still replace the page (GC-43).
(function () {
  const vf = path.join(ROOT, 'assets', 'pdf-viewer.js');
  if (!fs.existsSync(vf)) { violations.push('assets/pdf-viewer.js is missing'); return; }
  const v = fs.readFileSync(vf, 'utf8');
  if (!/window\.openMediaViewer\s*=/.test(v)) violations.push('assets/pdf-viewer.js does not export openMediaViewer');
  if (!/jpe\?g\|png/.test(v)) violations.push('assets/pdf-viewer.js does not recognise .jpg/.png links');
  if (!/addEventListener\('click',[\s\S]*?,\s*true\)/.test(v)) violations.push('assets/pdf-viewer.js click handler is not in the capture phase');
})();

if (violations.length) {
  console.error('media-links: ' + violations.length + ' violation(s)');
  violations.forEach(function (v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('media-links: OK (' + ROOT + ')');
