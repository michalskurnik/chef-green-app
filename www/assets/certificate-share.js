/**
 * certificate-share.js
 * Shared chef-certificate WhatsApp-share/export logic for completion.html
 * pages across packages (dinner, italy, ...). Draws the certificate
 * background + child's name + achievement caption + uploaded photo onto
 * a canvas, then shares or downloads it as a PNG.
 *
 * Requires on the page:
 *   - button#btn-wa            (the share button; its innerHTML is used as a loading-state placeholder)
 *   - .cert-achievement        (element whose text is drawn as the caption)
 *   - localStorage 'chefName'  (optional)
 *   - localStorage 'childPhoto' (optional, a data: URL)
 *   - ../assets/images/certificate-bg.png reachable relative to the page
 */
window.shareCertificate = async function () {
  var btn = document.getElementById('btn-wa');
  var originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ מכין תמונה...';
  btn.disabled = true;

  try {
    // Step 1: draw certificate background.
    // Canvas size is derived from the background's real natural dimensions
    // (not hardcoded) so it always matches the file's actual aspect ratio -
    // no stretch, and a differently-sized replacement file (retina, etc.)
    // just works without touching this code.
    var bg = new Image();
    bg.crossOrigin = 'anonymous';
    bg.src = '../assets/images/certificate-bg.png';
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

    // Step 2: draw child's name.
    // Position/size as percentages of W/H, matching the live CSS overlay
    // (.cert-name: top 39%, centered, ~5.3% of width font size).
    var name = localStorage.getItem('chefName') || '';
    if (name) {
      ctx.font = 'bold ' + Math.round(W * 0.0533) + 'px "Fredoka One", sans-serif';
      ctx.fillStyle = '#8B4513';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(name, W * 0.5, H * 0.44);
    }

    // Step 3: draw the achievement caption.
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

    // Step 4: draw child's photo clipped to circle (if uploaded).
    // Circle diameter is 31% of W, matching the live CSS's .cert-photo-wrap.
    var photoSrc = localStorage.getItem('childPhoto');
    if (photoSrc) {
      var photo = new Image();
      photo.src = photoSrc;
      await new Promise(function (resolve) { photo.onload = resolve; });

      var cx = W * 0.5, cy = H * 0.63, radius = W * 0.155;
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

    // Step 5: share or download
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
