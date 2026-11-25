/**
 * certificate-share.js
 * Shared chef-certificate WhatsApp-share/export logic for completion.html
 * pages across packages (dinner, italy, ...). Draws the certificate
 * background + optional title/sub-line + child's name + achievement
 * caption + optional gold ring + uploaded photo onto a canvas, then
 * shares or downloads it as a PNG.
 *
 * Requires on the page:
 *   - button#btn-wa            (the share button; its innerHTML is used as a loading-state placeholder)
 *   - .cert-bg                 (the background <img>; the canvas copies the on-screen layout relative to it)
 *   - .cert-name, .cert-photo-wrap, .cert-achievement (and .cert-title / .cert-subline where present):
 *                              drawn where they appear on screen (their CSS is the only layout source)
 *   - localStorage 'chefName'  (optional)
 *   - localStorage 'childPhoto' (optional, a data: URL)
 *
 * Optional per-page config (set before this script loads):
 *   window.CERT_CONFIG = {
 *     bg: 'path/to/background.png',      // default: '../assets/images/certificate-bg.png'
 *     title: 'Title text' | null,        // drawn only if truthy - background has none baked in
 *     titleColor: '#93560F',
 *     subline: 'Sub-line text' | null,
 *     sublineColor: '#5a3e1b',
 *     ring: true | false,                // draw a gold ring around the photo circle
 *     ringColor: '#CF9C33'
 *   };
 * Any package whose background already has a baked-in title/ring (e.g.
 * dinner's) should simply omit ring (and have no .cert-title/.cert-subline
 * element) so those draw calls are skipped entirely. title/subline in the
 * config are no longer drawn from here: the on-screen elements are copied.
 */
/**
 * Fit long names into their place on the certificate (GC-45).
 * Every element marked data-fit (the name, or on dinner the whole
 * "ניתנת בגאווה ל: <name>" line) keeps its design font size from the CSS
 * and is shrunk only when its text is wider than its CSS max-width - that
 * max-width is the clear paper between the artwork on both sides. The name
 * is never cut with "...". Re-runs when the web fonts arrive (they change
 * the widths) and on resize.
 */
window.fitCertificateText = function () {
  var els = document.querySelectorAll('[data-fit]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    el.style.fontSize = '';
    var design = parseFloat(getComputedStyle(el).fontSize);
    var need = el.scrollWidth, room = el.clientWidth;
    if (need > room + 0.5) {
      el.style.fontSize = (design * room / need * 0.98) + 'px';
      // A second pass absorbs rounding in the browser's text measuring.
      need = el.scrollWidth; room = el.clientWidth;
      if (need > room + 0.5) el.style.fontSize = (parseFloat(el.style.fontSize) * room / need * 0.98) + 'px';
    }
  }
};
(function () {
  var run = function () { window.fitCertificateText(); };
  run();
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(run);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', run);
  }
  window.addEventListener('load', run);
  window.addEventListener('resize', run);
})();

/**
 * Draws the certificate exactly as it is laid out on screen onto a canvas
 * and returns the canvas. Used by the share and print buttons.
 */
window.renderCertificateCanvas = async function () {
    var CFG = window.CERT_CONFIG || {};
    window.fitCertificateText();

    // Step 1: draw certificate background.
    // Canvas size is derived from the background's real natural dimensions
    // (not hardcoded) so it always matches the file's actual aspect ratio -
    // no stretch, and a differently-sized replacement file (retina, etc.)
    // just works without touching this code.
    var bg = new Image();
    bg.crossOrigin = 'anonymous';
    bg.src = CFG.bg || '../assets/images/certificate-bg.png';
    await new Promise(function (resolve, reject) {
      bg.onload = resolve;
      bg.onerror = reject;
    });

    var canvas = document.createElement('canvas');
    var W = 1200;
    var H = Math.round(W * (bg.naturalHeight / bg.naturalWidth));
    canvas.width  = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bg, 0, 0, W, H);

    // Steps 2-7: copy the LIVE layout onto the canvas (GC-45).
    // The canvas used to have its own hard-coded positions, separate from the
    // CSS of the page, so the two drifted apart and the photo circle covered
    // the name and the caption. Now every text and the photo circle are read
    // from the page with getBoundingClientRect(), relative to .cert-bg, and
    // scaled to the canvas width. One layout source: the page's CSS.
    var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
    // The race keeps a slow web-font load from losing the tap that
    // navigator.share needs.
    await Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1000); })]);
    // A web font that arrived during the wait changes the widths: fit again.
    window.fitCertificateText();

    var bgEl = document.querySelector('.cert-bg');
    var b = bgEl.getBoundingClientRect();
    var s = W / b.width;

    // Draws one overlay element's text at the centre of its on-screen box.
    // The text is never cut: if the canvas measures it a little wider than
    // its box on screen, the font is shrunk to the box width instead.
    function drawText(selector) {
      var el = document.querySelector(selector);
      if (!el) return;
      var text = el.textContent.trim();
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      if (!text || cs.display === 'none' || r.width === 0 || r.height === 0) return;
      var px = parseFloat(cs.fontSize) * s;
      var font = function () { return cs.fontWeight + ' ' + px + 'px ' + cs.fontFamily; };
      ctx.font = font();
      ctx.fillStyle = cs.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      var tw = ctx.measureText(text).width, box = r.width * s;
      if (tw > box + 1) { px = px * box / tw; ctx.font = font(); }
      ctx.fillText(text, (r.left - b.left + r.width / 2) * s, (r.top - b.top + r.height / 2) * s);
    }

    // Photo circle: position and size of .cert-photo-wrap on screen.
    var wrap = document.querySelector('.cert-photo-wrap');
    var wr = wrap ? wrap.getBoundingClientRect() : null;
    var cx = 0, cy = 0, outerRadius = 0, ringStroke = 0;
    if (wr) {
      cx = (wr.left - b.left + wr.width / 2) * s;
      cy = (wr.top - b.top + wr.height / 2) * s;
      outerRadius = wr.width / 2 * s;
      ringStroke = parseFloat(getComputedStyle(wrap).borderTopWidth) * s || 0;
    }

    // Draw order: background (done), title, sub-line, ring, photo, then the
    // name and the caption on top, so nothing can hide them.
    drawText('.cert-title');
    drawText('.cert-subline');

    // Gold ring, only if this package's background has no rope baked in.
    if (CFG.ring && wr) {
      ctx.save();
      ctx.lineWidth = ringStroke;
      ctx.strokeStyle = CFG.ringColor || '#CF9C33';
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius - ringStroke / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Child's photo clipped to the circle (if uploaded). With a ring it nests
    // inside it; without one (dinner) it fills the whole circle.
    var photoSrc = localStorage.getItem('childPhoto');
    if (photoSrc && wr) {
      var photo = new Image();
      photo.src = photoSrc;
      await new Promise(function (resolve) { photo.onload = resolve; photo.onerror = resolve; });

      var radius = CFG.ring ? (outerRadius - ringStroke) : outerRadius;
      var size = radius * 2;
      var imgRatio = photo.width / photo.height;
      var drawW, drawH, drawX, drawY;

      if (imgRatio > 1) {
        // Landscape - fit height, overflow width
        drawH = size;
        drawW = size * imgRatio;
        drawX = cx - drawW / 2;
        drawY = cy - radius;
      } else {
        // Portrait - fit width, overflow height
        drawW = size;
        drawH = size / imgRatio;
        drawX = cx - radius;
        drawY = cy - drawH / 2;
      }

      if (photo.width) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(photo, drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    }

    drawText('.cert-name');
    drawText('.cert-achievement');
    return canvas;
};

window.shareCertificate = async function (triggerBtn) {
  // The button that was tapped shows the loading state (the print button
  // passes itself in); default is the WhatsApp button as before.
  var btn = (triggerBtn && triggerBtn.nodeType === 1) ? triggerBtn : document.getElementById('btn-wa');
  var originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ מכין תמונה...';
  btn.disabled = true;

  try {
    var name = localStorage.getItem('chefName') || '';
    var canvas = await window.renderCertificateCanvas();

    // Step 8: share or download
    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });
    var imageFile = new File([blob], 'תעודת-שף.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      await navigator.share({
        files: [imageFile],
        title: 'תעודת שף מוסמך! 🎓',
        text: name ? name + ' קיבל תעודת שף מוסמך! 👨‍🍳🎉' : 'הילד שלי קיבל תעודת שף מוסמך! 👨‍🍳🎉'
      });
    } else {
      // Fallback: download the image
      var a = document.createElement('a');
      a.download = 'תעודת-שף.png';
      a.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
};

/**
 * "Print" button on the completion pages (GC-5).
 * window.print() does nothing in the iOS app's web view, so inside the app
 * the button opens the same share sheet as the WhatsApp button (it offers
 * Print, Save Image, Save to Files, WhatsApp...). In a normal browser the
 * regular print dialog still works.
 */
window.printCertificate = function (btn) {
  var C = window.Capacitor;
  if (C && C.isNativePlatform && C.isNativePlatform()) {
    window.shareCertificate(btn);
  } else {
    window.print();
  }
};
