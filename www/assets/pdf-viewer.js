/*
 * In-app PDF viewer for the recipe booklets.
 *
 * Inside the iOS app a plain link to a PDF replaced the whole page with the
 * PDF and left no way back (bug GC-4), and window.print() does nothing in
 * the app's web view (GC-5). Including this script on a page makes every
 * link to a .pdf open in a full-screen viewer instead: a "back" button, the
 * whole PDF scrollable and zoomable, and a share button that opens the
 * system share sheet (Save to Files, Print, WhatsApp, Mail...).
 *
 * The same viewer opens links straight to recipe images (.jpg/.jpeg/.png):
 * a plain link to an image replaced the page with the bare image and left no
 * way back (GC-43). Images are shown in the web view (DOM mode, scrollable,
 * full width), never through the native plugin. Links are caught in the
 * capture phase so no other click handler can navigate away first.
 *
 * In the app the PDF is drawn natively (PDFKit on iOS, Pdfium on Android) by
 * @capgo/capacitor-pdf-viewer, behind the transparent web view, with our
 * HTML header on top. A PDF inside an <iframe> is not an option there: iOS
 * shows only part of the first page and does not scroll. In a desktop
 * browser the iframe works, so it stays as the fallback.
 *
 * Usage: <script src="../assets/pdf-viewer.js"></script>
 *        links: <a href="x.pdf" download="name.pdf">  (picked up automatically;
 *               add data-no-viewer to a link to opt out)
 *        code:  openPdfViewer('x.pdf', 'name.pdf')  /  openMediaViewer(url, name)
 */
(function () {
  'use strict';

  var css = [
    '#pv{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;background:#525659;direction:rtl}',
    '#pv.open{display:flex}',
    '#pv-hdr{flex:none;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:#1A3D1F;color:#F5F0DC;font-family:Rubik,Arial,sans-serif}',
    '#pv-hdr button{flex:none;border:none;border-radius:18px;padding:9px 14px;font:700 15px Rubik,Arial,sans-serif;cursor:pointer;touch-action:manipulation}',
    '#pv-back{background:rgba(255,255,255,.16);color:#fff}',
    '#pv-share{background:#F5921E;color:#fff;margin-inline-start:auto}',
    '#pv-title{flex:1 1 auto;min-width:0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#pv-body{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}',
    '#pv-frame{display:block;width:100%;height:100%;border:0;background:#fff}',
    '#pv-img{display:none;width:100%;height:auto;background:#fff}',
    '#pv.img #pv-frame{display:none}',
    '#pv.img #pv-img{display:block}',
    '#pv-msg{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 20px);transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;font:600 14px Rubik,Arial,sans-serif;padding:8px 16px;border-radius:16px;display:none;max-width:90%;text-align:center}',
    // Native mode: the PDF is behind the web view, so everything except the
    // header must be see-through and must not catch touches.
    'html.pv-native,html.pv-native body{background:transparent!important}',
    'html.pv-native body>*:not(#pv){visibility:hidden!important}',
    'html.pv-native #pv{background:transparent;pointer-events:none}',
    'html.pv-native #pv-hdr{pointer-events:auto}',
    'html.pv-native #pv-body{display:none}',
    'html.pv-native #pv-msg{pointer-events:none}'
  ].join('');

  var root, frame, imgEl, hdr, titleEl, msgEl, current = null;
  var opening = null; // promise of a native pv.open() that has not finished yet
  var MEDIA_RE = /\.(pdf|jpe?g|png)(\?|#|$)/i;
  var IMG_RE = /\.(jpe?g|png)(\?|#|$)/i;

  function isImage(url) { return IMG_RE.test(url); }
  function mimeOf(url) {
    if (/\.png(\?|#|$)/i.test(url)) return 'image/png';
    if (isImage(url)) return 'image/jpeg';
    return 'application/pdf';
  }
  function stripExt(n) { return n.replace(/\.(pdf|jpe?g|png)$/i, ''); }

  function nativeViewer() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.PdfViewer;
  }

  function build() {
    if (root) return;
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    root = document.createElement('div');
    root.id = 'pv';
    root.setAttribute('role', 'dialog');
    root.innerHTML =
      '<div id="pv-hdr" data-capgo-pdf-interactive>' +
        '<button id="pv-back" type="button">→ חזרה</button>' +
        '<span id="pv-title"></span>' +
        '<button id="pv-share" type="button">שמירה / הדפסה / שיתוף</button>' +
      '</div>' +
      '<div id="pv-body"><iframe id="pv-frame" title="PDF"></iframe><img id="pv-img" alt=""></div>' +
      '<div id="pv-msg"></div>';
    document.body.appendChild(root);

    frame = root.querySelector('#pv-frame');
    imgEl = root.querySelector('#pv-img');
    hdr = root.querySelector('#pv-hdr');
    titleEl = root.querySelector('#pv-title');
    msgEl = root.querySelector('#pv-msg');
    root.querySelector('#pv-back').addEventListener('click', close);
    root.querySelector('#pv-share').addEventListener('click', share);

    var pv = nativeViewer();
    if (pv) {
      // Back gesture / native close: tidy up our side as well.
      pv.addListener('close', function () { if (current) cleanup(); });
      pv.addListener('error', function () { toast('לא הצלחנו להציג את החוברת'); });
    }
  }

  function toast(text, ms) {
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    clearTimeout(toast.t);
    if (ms !== 0) toast.t = setTimeout(function () { msgEl.style.display = 'none'; }, ms || 3500);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function open(url, name) {
    build();
    // Something is already open (PDF or image): close it first, and wait for
    // the native PDF to go away before showing the next one.
    if (current) {
      return close().then(function () { open(url, name); });
    }
    current = { url: url, name: name || url.split('/').pop() };
    titleEl.textContent = stripExt(current.name);
    var pv = nativeViewer();

    if (isImage(url)) {
      root.classList.add('img');
      root.classList.add('open');
      imgEl.src = url;
      return;
    }

    if (!pv) {
      root.classList.add('open');
      frame.src = url;
      return;
    }

    document.documentElement.classList.add('pv-native');
    root.classList.add('open');
    toast('טוען את החוברת...', 0);
    var c = current;
    fetch(url).then(function (r) { return r.blob(); }).then(blobToBase64).then(function (b64) {
      if (current !== c) return;
      var top = Math.ceil(hdr.getBoundingClientRect().bottom);
      var p = pv.open({
        source: b64,
        sourceType: 'base64',
        mode: 'underWebView',
        nativeUi: false,
        scrollMode: 'continuous',
        layout: { x: 0, y: top, width: 0, height: window.innerHeight - top }
      });
      opening = p;
      return p.then(function () {
        if (current === c) msgEl.style.display = 'none';
      });
    }).catch(function () {
      toast('לא הצלחנו להציג את החוברת');
    });
  }

  function cleanup() {
    root.classList.remove('open');
    root.classList.remove('img');
    document.documentElement.classList.remove('pv-native');
    frame.src = 'about:blank';
    imgEl.removeAttribute('src');
    msgEl.style.display = 'none';
    current = null;
  }

  // Always returns a Promise: open() waits for it when switching files.
  function close() {
    if (!root) return Promise.resolve();
    var pv = nativeViewer();
    if (pv && document.documentElement.classList.contains('pv-native')) {
      // "Back" tapped while the native PDF is still opening: wait for the open
      // to finish first, otherwise the PDF appears afterwards, hidden behind
      // the page, and the next open finds it "already open".
      var pending = opening || Promise.resolve();
      opening = null;
      return pending.catch(function () {}).then(function () { return pv.close(); })
        .catch(function () {}).then(cleanup);
    }
    cleanup();
    return Promise.resolve();
  }

  function share() {
    if (!current) return;
    var c = current;
    fetch(c.url).then(function (r) { return r.blob(); }).then(function (blob) {
      var file = new File([blob], c.name, { type: mimeOf(c.url) });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: stripExt(c.name) });
      }
      // No file sharing (desktop browser): fall back to a normal download.
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = c.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return; // user closed the share sheet
      toast('לא הצלחנו לפתוח את חלון השיתוף');
    });
  }

  window.openPdfViewer = open;
  window.openMediaViewer = open;

  // Capture phase: runs before any handler on the link or on the page, so a
  // link to a PDF or an image can never navigate the web view away (GC-4,
  // GC-43, GC-44).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-no-viewer')) return;
    var href = a.getAttribute('href');
    if (!MEDIA_RE.test(href)) return;
    e.preventDefault();
    e.stopPropagation();
    open(href, a.getAttribute('download') || '');
  }, true);
})();
