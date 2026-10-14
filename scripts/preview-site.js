// Local preview for the landing pages, with the same routes as greenchef.foodgames.co.il.
// Usage: node scripts/preview-site.js  ->  http://localhost:5180
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pages = { '/': 'site/index.html', '/workshops': 'site/workshops.html', '/accessibility': 'site/accessibility.html' };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let rel = pages[url] || (url.startsWith('/site/') ? url.slice(1) : 'www' + url);
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(5180, () => console.log('Preview on http://localhost:5180'));
