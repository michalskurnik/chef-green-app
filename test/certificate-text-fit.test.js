// Guard for GC-45 (round 2): long names and the captions must never be cut
// or run onto the certificate artwork.
//  - every certificate marks its name (dinner: the whole "ניתנת בגאווה ל: <name>"
//    line), caption and title with data-fit, so certificate-share.js shrinks
//    them into their max-width (the clear paper measured on each background)
//    instead of letting them overflow;
//  - the name is never cut with "..." (no text-overflow:ellipsis on the page,
//    no "…" truncation in the share image);
//  - dinner: the page and the share image use the same background, the one
//    without the baked "ניתנת בגאווה ל:" line, and the name sits next to that
//    line as a sibling (not nested, or the share image would draw it twice).
// The real pixel geometry (text vs artwork) needs a browser; it was measured in
// the iOS Simulator for 3 screen widths x 7 names (see the GC-45 ticket).
//
// Usage: node test/certificate-text-fit.test.js [ROOT]   (ROOT defaults to ../www)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
const violations = [];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const share = read('assets/certificate-share.js');
if (share.indexOf('fitCertificateText') === -1) violations.push('certificate-share.js has no fitCertificateText (long names are not fitted)');
if (share.indexOf("'…'") !== -1 || share.indexOf('"…"') !== -1) violations.push('certificate-share.js still cuts text with "…"');
if (!/renderCertificateCanvas[\s\S]*fitCertificateText\(\)/.test(share)) violations.push('renderCertificateCanvas does not fit the texts before drawing');

['dinner', 'italy', 'protein', 'stem'].forEach(function (pkg) {
  const f = pkg + '/completion.html';
  const html = read(f);
  const tag = function (cls) {
    const m = html.match(new RegExp('<(div|span)[^>]*class="' + cls + '"[^>]*>'));
    return m ? m[0] : null;
  };
  const nameHolder = pkg === 'dinner' ? 'cert-name-row' : 'cert-name';
  [nameHolder, 'cert-achievement'].concat(pkg === 'dinner' ? [] : ['cert-title']).forEach(function (cls) {
    const t = tag(cls);
    if (!t) violations.push(f + ': no .' + cls + ' element');
    else if (t.indexOf('data-fit') === -1) violations.push(f + ': .' + cls + ' has no data-fit');
  });
  if (/text-overflow\s*:\s*ellipsis/.test(html)) violations.push(f + ': text-overflow:ellipsis would cut the name');
  // every fitted element needs a max-width to fit into
  [nameHolder, 'cert-achievement'].forEach(function (cls) {
    const css = html.match(new RegExp('\\.' + cls + '\\{[^}]*\\}'));
    if (!css || !/max-width\s*:\s*\d+(\.\d+)?%/.test(css[0])) violations.push(f + ': .' + cls + ' has no max-width in %');
  });
  if (pkg === 'dinner') {
    const img = (html.match(/<img src="([^"]+)"\s*class="cert-bg"/) || [])[1];
    const cfg = (html.match(/CERT_CONFIG\s*=\s*\{\s*bg:\s*'([^']+)'/) || [])[1];
    if (!img || img !== cfg) violations.push(f + ': page background (' + img + ') and share background (' + cfg + ') differ');
    if (img && img.indexOf('certificate-bg-dinner-blank.png') === -1) violations.push(f + ': not using the background without the baked line');
    if (img && !fs.existsSync(path.join(ROOT, pkg, img))) violations.push(f + ': background file missing: ' + img);
    if (!/class="cert-name-row"[^>]*><span class="cert-subline">[^<]*<\/span><span class="cert-name"/.test(html)) violations.push(f + ': subline and name are not sibling spans in .cert-name-row');
  }
});

if (violations.length) {
  console.error('certificate-text-fit: ' + violations.length + ' violation(s)');
  violations.forEach(function (v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('certificate-text-fit: OK (' + ROOT + ')');
