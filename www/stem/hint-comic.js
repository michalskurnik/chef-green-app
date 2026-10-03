/**
 * hint-comic.js
 * Generic "hint comic" overlay (Asana 1218982193938989): a full-screen,
 * swipeable mini-comic shown on top of a lab game's conclusion screen,
 * built entirely from EXISTING character/background PNGs (no new
 * illustrated artwork) plus a small CSS-drawn bottle+balloon diagram
 * that reacts per panel (water level, bubbles, balloon inflation).
 *
 * A game opts in by setting window.LAB_CONFIG.hintComic to a config
 * object before dial-lab.js runs; dial-lab.js's renderConclusion() then
 * shows a "💡 רמז" button that calls window.openHintComic(CFG.hintComic).
 *
 * hintComic config shape:
 * {
 *   bg: 'assets/backgrounds/stem_bg_s1_yeast.png',
 *   accent: '#C68C46',   // balloon + CTA color, matches the game's --c1
 *   ctaLabel: 'הבנתי! 💡',
 *   panels: [
 *     {
 *       caption: '...',
 *       char: 'bito_pointing' | 'bito_thinking' | 'bito_surprised' | 'bito_happy'
 *           | 'chef_stand' | 'yeast_sleeping' | 'yeast_happy' | 'yeast_fainted',
 *       char2: (optional second character, same id set, shown smaller beside it),
 *       bounce: true|false,        // bobbing idle animation on the main character
 *       bottle: { water: 0-1, sugar: bool, bubbles: bool },
 *       balloon: 0-1               // inflation scale; 0/omitted = not attached yet
 *     }, ...
 *   ]
 * }
 */
(function () {
  'use strict';

  var CHAR_SRC = {
    bito_pointing:   'assets/characters/stem_char_bito_pointing.png',
    bito_thinking:   'assets/characters/stem_char_bito_thinking.png',
    bito_surprised:  'assets/characters/stem_char_bito_surprised.png',
    bito_happy:      'assets/characters/stem_char_bito_happy.png',
    chef_stand:      'assets/characters/stem_char_chef_stand.png',
    yeast_sleeping:  'assets/characters/stem_char_yeast_sleeping.png',
    yeast_happy:     'assets/characters/stem_char_yeast_happy.png',
    yeast_fainted:   'assets/characters/stem_char_yeast_fainted.png'
  };

  var STYLE = '' +
    '#hint-overlay{position:fixed;inset:0;z-index:999;background:#12332B;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:space-between;padding:env(safe-area-inset-top,12px) 14px env(safe-area-inset-bottom,18px);animation:hcFadeIn .25s ease}' +
    '@keyframes hcFadeIn{from{opacity:0}to{opacity:1}}' +
    '#hc-top{width:100%;max-width:480px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding-top:2px}' +
    '#hc-counter{font-family:"Rubik",sans-serif;font-size:14px;font-weight:700;color:rgba(255,255,255,.75);direction:ltr;unicode-bidi:isolate}' +
    '#hc-close{background:rgba(255,255,255,.14);border:none;border-radius:50%;width:34px;height:34px;color:#fff;font-size:17px;' +
      'cursor:pointer;touch-action:manipulation}' +
    '#hc-stage{position:relative;flex:1;width:100%;max-width:480px;min-height:0;border-radius:22px;overflow:hidden;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.5);margin:10px 0;cursor:pointer;background:#2a4a40 no-repeat center/cover}' +
    '#hc-scene{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;gap:4%;padding:0 6% 32%}' +
    '#hc-bottle-wrap{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;position:relative}' +
    '#hc-balloon{display:none;width:58px;height:66px;border-radius:50% 50% 50% 50%/55% 55% 45% 45%;' +
      'box-shadow:inset -8px -8px 14px rgba(0,0,0,.18),inset 6px 8px 10px rgba(255,255,255,.35);margin-bottom:-6px;' +
      'transform-origin:bottom center;transition:transform .9s cubic-bezier(.34,1.3,.64,1)}' +
    '#hc-balloon::after{content:"";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:0;height:0;' +
      'border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid currentColor;opacity:.85}' +
    '#hc-balloon.hc-wobble{animation:hcWobble 1.6s ease-in-out infinite}' +
    '@keyframes hcWobble{0%,100%{transform:rotate(-3deg) scale(var(--hc-inflate,1))}50%{transform:rotate(3deg) scale(var(--hc-inflate,1))}}' +
    '#hc-bottle{position:relative;width:62px;height:104px;border:3px solid rgba(255,255,255,.55);border-top-width:0;' +
      'border-radius:4px 4px 18px 18px;overflow:hidden;background:linear-gradient(135deg,rgba(255,255,255,.3) 0%,rgba(255,255,255,.08) 45%,' +
      'rgba(255,255,255,.22) 65%,rgba(255,255,255,.06) 100%)}' +
    '#hc-bottle::before{content:"";position:absolute;left:50%;top:-14px;transform:translateX(-50%);width:20px;height:16px;' +
      'border:3px solid rgba(255,255,255,.55);border-bottom:none;border-radius:6px 6px 0 0;background:rgba(255,255,255,.12)}' +
    '#hc-liquid{position:absolute;bottom:0;left:0;right:0;height:0%;background:linear-gradient(180deg,#F7D98A,#E0A868);transition:height 1s ease}' +
    '#hc-liquid.hc-sugary{background:linear-gradient(180deg,#FBE7AE,#E8B878)}' +
    '#hc-bubbles{position:absolute;inset:0;opacity:0;transition:opacity .4s;' +
      'background:radial-gradient(circle 3px at 28% 85%,rgba(255,255,255,.9) 90%,transparent),' +
      'radial-gradient(circle 2.5px at 58% 65%,rgba(255,255,255,.85) 90%,transparent),' +
      'radial-gradient(circle 4px at 42% 45%,rgba(255,255,255,.75) 90%,transparent)}' +
    '#hc-bubbles.hc-on{opacity:1;animation:hcBubbleUp 1.1s ease-in-out infinite}' +
    '@keyframes hcBubbleUp{0%{background-position:0 100%,0 100%,0 100%;opacity:.3}100%{background-position:0 -20%,0 -30%,0 -40%;opacity:1}}' +
    '#hc-char-wrap{flex:0 0 auto;display:flex;align-items:flex-end;gap:4px}' +
    '#hc-char,#hc-char2{height:34vh;max-height:230px;width:auto;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}' +
    '#hc-char2{height:24vh;max-height:160px}' +
    '.hc-bounce{animation:hcBounce 1.4s ease-in-out infinite}' +
    '@keyframes hcBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}' +
    '#hc-caption{position:absolute;bottom:0;left:0;right:0;background:#F5F0DC;padding:14px 18px;font-family:"Fredoka One",cursive;' +
      'font-size:clamp(16px,5vw,21px);color:#12332B;text-align:center;line-height:1.4;direction:rtl}' +
    '#hc-cta{display:none;width:100%;max-width:320px;color:#fff;border:none;border-radius:50px;padding:16px 26px;' +
      'font-family:"Fredoka One",cursive;font-size:20px;text-align:center;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3);' +
      'touch-action:manipulation;margin-top:2px;flex-shrink:0}' +
    '#hc-cta:active{transform:scale(.97)}' +
    '#hc-dots{display:flex;gap:7px;justify-content:center;align-items:center;padding-top:6px;flex-shrink:0}' +
    '.hc-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.3);transition:background .25s,transform .25s}' +
    '.hc-dot-active{transform:scale(1.35)}';

  function injectStyle() {
    if (document.getElementById('hint-comic-style')) return;
    var s = document.createElement('style');
    s.id = 'hint-comic-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  window.openHintComic = function (cfg) {
    injectStyle();
    var accent = cfg.accent || '#F5921E';
    var current = 0;

    var overlay = document.createElement('div');
    overlay.id = 'hint-overlay';
    overlay.innerHTML =
      '<div id="hc-top"><span id="hc-counter"></span><button id="hc-close" aria-label="סגור">✕</button></div>' +
      '<div id="hc-stage">' +
        '<div id="hc-scene">' +
          '<div id="hc-bottle-wrap">' +
            '<div id="hc-balloon"></div>' +
            '<div id="hc-bottle"><div id="hc-liquid"></div><div id="hc-bubbles"></div></div>' +
          '</div>' +
          '<div id="hc-char-wrap"><img id="hc-char2" style="display:none"><img id="hc-char"></div>' +
        '</div>' +
        '<div id="hc-caption"></div>' +
      '</div>' +
      '<button id="hc-cta"></button>' +
      '<div id="hc-dots"></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#hc-stage').style.backgroundImage = "url('" + cfg.bg + "')";
    var dotsEl = overlay.querySelector('#hc-dots');
    cfg.panels.forEach(function () {
      var d = document.createElement('span');
      d.className = 'hc-dot';
      dotsEl.appendChild(d);
    });

    var charEl    = overlay.querySelector('#hc-char');
    var char2El   = overlay.querySelector('#hc-char2');
    var liquidEl  = overlay.querySelector('#hc-liquid');
    var bubblesEl = overlay.querySelector('#hc-bubbles');
    var balloonEl = overlay.querySelector('#hc-balloon');
    var captionEl = overlay.querySelector('#hc-caption');
    var counterEl = overlay.querySelector('#hc-counter');
    var ctaBtn    = overlay.querySelector('#hc-cta');
    var closeBtn  = overlay.querySelector('#hc-close');
    var stage     = overlay.querySelector('#hc-stage');

    balloonEl.style.color = accent;
    balloonEl.style.background = accent;
    ctaBtn.style.background = accent;
    ctaBtn.style.textContent = '';

    function close() { overlay.remove(); }
    closeBtn.onclick = close;

    function renderPanel(idx) {
      current = idx;
      var p = cfg.panels[idx];

      charEl.src = CHAR_SRC[p.char] || CHAR_SRC.bito_pointing;
      charEl.alt = p.char || '';
      charEl.classList.toggle('hc-bounce', !!p.bounce);
      if (p.char2) {
        char2El.src = CHAR_SRC[p.char2] || '';
        char2El.alt = p.char2;
        char2El.style.display = 'block';
      } else {
        char2El.style.display = 'none';
      }

      var water = (p.bottle && p.bottle.water) || 0;
      liquidEl.style.height = Math.round(water * 72) + '%';
      liquidEl.classList.toggle('hc-sugary', !!(p.bottle && p.bottle.sugar));
      bubblesEl.classList.toggle('hc-on', !!(p.bottle && p.bottle.bubbles));

      var inflate = p.balloon || 0;
      if (inflate > 0) {
        balloonEl.style.display = 'block';
        var scale = 0.4 + inflate * 0.7;
        balloonEl.style.setProperty('--hc-inflate', scale);
        balloonEl.style.transform = 'scale(' + scale + ')';
        balloonEl.classList.toggle('hc-wobble', inflate >= 0.85);
      } else {
        balloonEl.style.display = 'none';
        balloonEl.classList.remove('hc-wobble');
      }

      captionEl.textContent = p.caption;
      counterEl.textContent = (idx + 1) + ' / ' + cfg.panels.length;
      Array.prototype.forEach.call(dotsEl.children, function (d, i) {
        d.classList.toggle('hc-dot-active', i === idx);
      });

      if (idx === cfg.panels.length - 1) {
        ctaBtn.style.display = 'block';
        ctaBtn.textContent = cfg.ctaLabel || 'הבנתי! 💡';
        stage.onclick = null;
      } else {
        ctaBtn.style.display = 'none';
        stage.onclick = next;
      }
    }

    function next() {
      if (current < cfg.panels.length - 1) renderPanel(current + 1);
    }
    ctaBtn.onclick = close;

    var touchStartX = 0;
    overlay.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', function (e) {
      var dx = touchStartX - e.changedTouches[0].clientX;
      if (dx > 40) next();
    }, { passive: true });

    renderPanel(0);
  };
})();
