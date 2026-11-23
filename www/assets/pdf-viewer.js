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
 * In the app the PDF is drawn natively (PDFKit on iOS, Pdfium on Android) by
 * @capgo/capacitor-pdf-viewer, behind the transparent web view, with our
 * HTML header on top. A PDF inside an <iframe> is not an option there: iOS
 * shows only part of the first page and does not scroll. In a desktop
 * browser the iframe works, so it stays as the fallback.
 *
 * Usage: <script src="../assets/pdf-viewer.js"></script>
 *        links: <a href="x.pdf" download="name.pdf">  (picked up automatically)
 *        code:  openPdfViewer('x.pdf', 'name.pdf')
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

  var root, frame, hdr, titleEl, msgEl, current = null;

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
      '<div id="pv-body"><iframe id="pv-frame" title="PDF"></iframe></div>' +
      '<div id="pv-msg"></div>';
    document.body.appendChild(root);

    frame = root.querySelector('#pv-frame');
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
    current = { url: url, name: name || url.split('/').pop() };
    titleEl.textContent = current.name.replace(/\.pdf$/i, '');
    var pv = nativeViewer();

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
      return pv.open({
        source: b64,
        sourceType: 'base64',
        mode: 'underWebView',
        nativeUi: false,
        scrollMode: 'continuous',
        layout: { x: 0, y: top, width: 0, height: window.innerHeight - top }
      }).then(function () { msgEl.style.display = 'none'; });
    }).catch(function () {
      toast('לא הצלחנו להציג את החוברת');
    });
  }

  function cleanup() {
    root.classList.remove('open');
    document.documentElement.classList.remove('pv-native');
    frame.src = 'about:blank';
    msgEl.style.display = 'none';
    current = null;
  }

  function close() {
    if (!root) return;
    var pv = nativeViewer();
    if (pv && document.documentElement.classList.contains('pv-native')) {
      pv.close().catch(function () {}).then(cleanup);
    } else {
      cleanup();
    }
  }

  function share() {
    if (!current) return;
    var c = current;
    fetch(c.url).then(function (r) { return r.blob(); }).then(function (blob) {
      var file = new File([blob], c.name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: c.name.replace(/\.pdf$/i, '') });
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

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !/\.pdf(\?|#|$)/i.test(a.getAttribute('href'))) return;
    e.preventDefault();
    open(a.getAttribute('href'), a.getAttribute('download') || '');
  });
})();
