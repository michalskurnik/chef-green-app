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
 *   - .cert-achievement        (element whose text is drawn as the caption)
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
 * dinner's) should simply omit title/subline/ring so those draw calls
 * are skipped entirely.
 */
window.shareCertificate = async function () {
  var btn = document.getElementById('btn-wa');
  var originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ מכין תמונה...';
  btn.disabled = true;

  try {
    var CFG = window.CERT_CONFIG || {};

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

    // Step 2: draw the title (only if this package's background needs one
    // drawn - dinner's has it baked into the artwork, so CFG.title is unset).
    if (CFG.title) {
      var titleSize = Math.round(W * 0.045);
      ctx.font = 'bold ' + titleSize + 'px "Fredoka One", sans-serif';
      ctx.fillStyle = CFG.titleColor || '#93560F';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(CFG.title, W * 0.5, H * 0.163);
    }

    // Step 3: draw the sub-line ("awarded with pride to:"), same condition.
    if (CFG.subline) {
      var subSize = Math.round(W * 0.022);
      ctx.font = subSize + 'px "Rubik", sans-serif';
      ctx.fillStyle = CFG.sublineColor || '#5a3e1b';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(CFG.subline, W * 0.5, H * 0.281);
    }

    // Step 4: draw child's name.
    // Position/size as percentages of W/H, matching the live CSS overlay
    // (.cert-name: top 39%, centered, ~5.3% of width font size). Unchanged
    // by CERT_CONFIG - same position for every package.
    var name = localStorage.getItem('chefName') || '';
    if (name) {
      ctx.font = 'bold ' + Math.round(W * 0.0533) + 'px "Fredoka One", sans-serif';
      ctx.fillStyle = '#8B4513';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(name, W * 0.5, H * 0.44);
    }

    // Step 5: draw the achievement caption.
    // Read live from the DOM so it always matches this page's own text and
    // can never drift out of sync (this is what makes the file shareable
    // across packages without per-package parameters).
    var capEl = document.querySelector('.cert-achievement');
    if (capEl && capEl.textContent.trim()) {
      ctx.font = Math.round(W * 0.02) + 'px "Rubik", sans-serif';
      ctx.fillStyle = '#5a3e1b';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(capEl.textContent.trim(), W * 0.5, H * 0.80);
    }

    // Step 6: draw a gold ring around the photo circle, only if this
    // package's background doesn't already have a rope/ring baked in.
    var outerRadius = W * 0.155;   // 31% diameter, same footprint as before
    var ringStroke  = W * 0.01;
    if (CFG.ring) {
      ctx.save();
      ctx.lineWidth = ringStroke;
      ctx.strokeStyle = CFG.ringColor || '#CF9C33';
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.63, outerRadius - ringStroke / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Step 7: draw child's photo clipped to circle (if uploaded).
    // When a ring is drawn, the photo nests inside it rather than covering
    // it; otherwise (dinner) the photo fills the full 31%-of-width circle,
    // exactly as before.
    var photoSrc = localStorage.getItem('childPhoto');
    if (photoSrc) {
      var photo = new Image();
      photo.src = photoSrc;
      await new Promise(function (resolve) { photo.onload = resolve; });

      var cx = W * 0.5, cy = H * 0.63;
      var radius = CFG.ring ? (outerRadius - ringStroke) : outerRadius;
      var size = radius * 2;
      var imgRatio = photo.width / photo.height;
      var drawW, drawH, drawX, drawY;

      if (imgRatio > 1) {
        // Landscape — fit height, overflow width
        drawH = size;
        drawW = size * imgRatio;
        drawX = cx - drawW / 2;
        drawY = cy - radius;
      } else {
        // Portrait — fit width, overflow height
        drawW = size;
        drawH = size / imgRatio;
        drawX = cx - radius;
        drawY = cy - drawH / 2;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(photo, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

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
