/**
 * DragZones — image-coordinate drag/drop zone system
 *
 * Standard setup for background-image drag/drop games:
 *   1. Background must be <img class inside .game-area> with object-fit:cover
 *   2. Zones defined in original image pixel coordinates
 *   3. Separate hit (detection) and visual (highlight) rects per zone
 *   4. Debug mode: click anywhere to log imgX/imgY for calibration
 *
 * Usage:
 *   const dz = new DragZones({ img, zones, debug });
 *
 *   dz.zoneAtPoint(px, py)        → zoneId | null   (viewport coords)
 *   dz.zoneAtElement(el)          → zoneId | null   (center of element)
 *   dz.highlight(zoneId | null)   → sets .over on matching zone.el
 *   dz.clearHighlight()           → removes .over from all zone els
 *   dz.logDrag(itemId, cloneEl)   → debug panel log during drag
 *
 * Zone definition:
 *   {
 *     hit:    { x, y, width, height },  // detection area (image px)
 *     visual: { x, y, width, height },  // highlight area  (image px, defaults to hit)
 *     el:     HTMLElement,              // the zone div to position + highlight
 *   }
 */
class DragZones {
  constructor({ img, zones, debug = false }) {
    this.img   = img;
    this.zones = zones;
    this.debug = debug;
    this._panel = null;

    for (const z of Object.values(this.zones)) {
      if (!z.visual) z.visual = z.hit;
    }

    this._reposition = this._reposition.bind(this);
    window.addEventListener('resize', this._reposition);

    if (img.complete && img.naturalWidth) {
      this._reposition();
    } else {
      img.addEventListener('load', this._reposition);
    }

    if (debug) this._initDebug();
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Convert an image-pixel rect to a viewport rect.
   * Accounts for object-fit:cover uniform scaling and centering offset.
   */
  toViewport(rect) {
    const img   = this.img;
    const box   = img.getBoundingClientRect();
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const ox    = (box.width  - img.naturalWidth  * scale) / 2;
    const oy    = (box.height - img.naturalHeight * scale) / 2;
    return {
      left:   box.left + ox + rect.x * scale,
      top:    box.top  + oy + rect.y * scale,
      right:  box.left + ox + (rect.x + rect.width)  * scale,
      bottom: box.top  + oy + (rect.y + rect.height) * scale,
    };
  }

  /** Hit-test a viewport point against all hit zones. Returns zone id or null. */
  zoneAtPoint(px, py) {
    for (const [id, zone] of Object.entries(this.zones)) {
      const r = this.toViewport(zone.hit);
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return id;
    }
    return null;
  }

  /** Hit-test using the center point of a DOM element (e.g. drag clone). */
  zoneAtElement(el) {
    const r = el.getBoundingClientRect();
    return this.zoneAtPoint(r.left + r.width / 2, r.top + r.height / 2);
  }

  /** Add .over to the matching zone element, remove it from all others. */
  highlight(activeId) {
    for (const [id, zone] of Object.entries(this.zones)) {
      if (zone.el) zone.el.classList.toggle('over', id === activeId);
    }
  }

  /** Remove .over from all zone elements. */
  clearHighlight() {
    for (const zone of Object.values(this.zones)) {
      if (zone.el) zone.el.classList.remove('over');
    }
  }

  /** Log item id and zone during drag (no-op in production). */
  logDrag(itemId, cloneEl) {
    if (!this.debug || !this._panel) return;
    const r      = cloneEl.getBoundingClientRect();
    const cx     = Math.round(r.left + r.width  / 2);
    const cy     = Math.round(r.top  + r.height / 2);
    const zoneId = this.zoneAtPoint(cx, cy);
    this._log(`item:${itemId}  cx:${cx}  cy:${cy}  zone:${zoneId || 'none'}`);
  }

  // ── Private ───────────────────────────────────────────────────────

  _reposition() {
    if (!this.img.naturalWidth) return;
    const wrap = this.img.closest('.game-area').getBoundingClientRect();
    for (const zone of Object.values(this.zones)) {
      if (!zone.el) continue;
      const r = this.toViewport(zone.visual);
      zone.el.style.left   = (r.left   - wrap.left) + 'px';
      zone.el.style.top    = (r.top    - wrap.top)  + 'px';
      zone.el.style.width  = (r.right  - r.left)    + 'px';
      zone.el.style.height = (r.bottom - r.top)     + 'px';
    }
    if (this.debug) this._drawOverlays();
  }

  _initDebug() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:165px', 'left:0', 'right:0', 'z-index:9998',
      'background:rgba(0,0,0,.82)', 'color:#0f0', 'font:11px/1.7 monospace',
      'padding:5px 10px', 'pointer-events:none', 'white-space:pre',
    ].join(';');
    document.body.appendChild(panel);
    this._panel = panel;

    window.addEventListener('resize', () => this._drawOverlays());
    this.img.addEventListener('load', () => { this._reposition(); this._drawOverlays(); });
    setTimeout(() => this._drawOverlays(), 120);

    // Click anywhere in the game area → log image-pixel coords for calibration
    this.img.closest('.game-area').addEventListener('click', e => {
      const box   = this.img.getBoundingClientRect();
      const scale = Math.max(box.width / this.img.naturalWidth, box.height / this.img.naturalHeight);
      const ox    = (box.width  - this.img.naturalWidth  * scale) / 2;
      const oy    = (box.height - this.img.naturalHeight * scale) / 2;
      const imgX  = Math.round((e.clientX - box.left - ox) / scale);
      const imgY  = Math.round((e.clientY - box.top  - oy) / scale);
      this._log(`[calibrate] imgX:${imgX}  imgY:${imgY}  (natural ${this.img.naturalWidth}×${this.img.naturalHeight})`);
    });
  }

  _drawOverlays() {
    document.querySelectorAll('.dz-dbg-overlay').forEach(e => e.remove());
    const COLORS = ['#00cc44', '#cc2200', '#0088ff', '#ffaa00', '#cc00cc', '#00cccc'];
    let i = 0;
    for (const [id, zone] of Object.entries(this.zones)) {
      const color = COLORS[i++ % COLORS.length];
      this._overlay(this.toViewport(zone.hit),    `rgba(${this._rgb(color)},.28)`, color, id,   false);
      if (zone.visual !== zone.hit) {
        this._overlay(this.toViewport(zone.visual), 'transparent',                  color, '',   true);
      }
    }
  }

  _overlay(r, bg, border, label, dashed) {
    const el = document.createElement('div');
    el.className = 'dz-dbg-overlay';
    el.style.cssText = [
      'position:fixed', 'z-index:9997', 'pointer-events:none', 'border-radius:8px',
      `left:${r.left}px`,  `top:${r.top}px`,
      `width:${r.right - r.left}px`, `height:${r.bottom - r.top}px`,
      `background:${bg}`,
      `border:2px ${dashed ? 'dashed' : 'solid'} ${border}`,
      'color:#fff', 'font:bold 11px/1.1 sans-serif',
      'display:flex', 'align-items:center', 'justify-content:center', 'text-align:center',
    ].join(';');
    el.textContent = label;
    document.body.appendChild(el);
  }

  _log(msg) {
    if (this._panel) this._panel.textContent = msg;
    console.log('[DragZones]', msg);
  }

  _rgb(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  }
}
