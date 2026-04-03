/**
 * station-flow.js
 * Universal station navigation layer for Dinner Adventure.
 * Inject this script into game4–game11. It intercepts done-panel
 * buttons and shows a transition overlay before navigating.
 */
(function () {
  'use strict';

  // ── Routing table ────────────────────────────────────────────
  var ROUTING = {
    'game4.html':  { next: 'game5.html',  station: 2, isLast: false },
    'game5.html':  { next: 'index.html',  station: 2, isLast: true  },
    'game6.html':  { next: 'game7.html',  station: 3, isLast: false },
    'game7.html':  { next: 'index.html',  station: 3, isLast: true  },
    'game8.html':  { next: 'game9.html',  station: 4, isLast: false },
    'game9.html':  { next: 'index.html',  station: 4, isLast: true  },
    'game10.html': { next: 'game11.html', station: 5, isLast: false },
    'game11.html': { next: 'index.html',  station: 5, isLast: true  }
  };

  var page = window.location.pathname.split('/').pop() || '';
  var flow = ROUTING[page];
  if (!flow) return; // not a managed game

  // ── Inject styles ─────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#sf-overlay{position:fixed;inset:0;z-index:9999;background:linear-gradient(160deg,#3949AB 0%,#7B1FA2 100%);',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;',
    'padding:32px 24px;font-family:"Assistant",sans-serif;direction:rtl;',
    'animation:sfIn .35s ease;}',
    '@keyframes sfIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}',
    '@keyframes sfPop{from{transform:scale(0) rotate(-20deg);opacity:0}to{transform:scale(1);opacity:1}}',
    '@keyframes sfStar{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}',
    '#sf-overlay .sf-icon{font-size:64px;margin-bottom:16px;display:block;animation:sfPop .5s .1s both ease;}',
    '#sf-overlay .sf-title{font-family:"Fredoka One",cursive;font-size:26px;color:#FFD54F;margin-bottom:10px;}',
    '#sf-overlay .sf-sub{font-size:14px;color:rgba(255,255,255,.85);font-weight:700;line-height:1.65;margin-bottom:20px;}',
    '#sf-overlay .sf-stars{font-size:30px;letter-spacing:4px;margin-bottom:18px;animation:sfStar 1.2s ease-in-out infinite;}',
    '#sf-overlay .sf-btn{background:linear-gradient(135deg,#FF6B35,#F7C948);color:#fff;border:none;',
    'border-radius:20px;padding:15px 46px;font-size:18px;font-family:"Fredoka One",cursive;',
    'cursor:pointer;box-shadow:0 6px 22px rgba(255,107,53,.5);width:100%;max-width:300px;}',
    '#sf-overlay .sf-btn.green{background:linear-gradient(135deg,#4CAF50,#66BB6A);',
    'box-shadow:0 5px 18px rgba(76,175,80,.5);}'
  ].join('');
  document.head.appendChild(style);

  // ── Build overlay HTML ────────────────────────────────────────
  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'sf-overlay';

    if (flow.isLast) {
      el.innerHTML =
        '<span class="sf-icon">🎉</span>' +
        '<div class="sf-title">כל הכבוד!</div>' +
        '<div class="sf-stars">⭐⭐⭐</div>' +
        '<div class="sf-sub">סיימתם את התחנה!<br>המתכון הסודי נחשף 🍽️</div>' +
        '<button class="sf-btn" id="sf-cta">🏠 חזרה לדף הבית</button>';
    } else {
      el.innerHTML =
        '<span class="sf-icon">✅</span>' +
        '<div class="sf-title">מעולה!</div>' +
        '<div class="sf-sub">עוד חלק נחשף! 🔓<br><small style="opacity:.7">אתם מתקדמים!</small></div>' +
        '<button class="sf-btn green" id="sf-cta">להמשך ▶</button>';
    }

    document.body.appendChild(el);

    document.getElementById('sf-cta').addEventListener('click', function () {
      if (flow.isLast) {
        localStorage.setItem('station' + flow.station + '_completed', '1');
        localStorage.setItem('recipe' + flow.station + '_completed', '1');
      }
      window.location.href = flow.next;
    });
  }

  // ── Patch done-panel buttons ──────────────────────────────────
  function patchPanel(panel) {
    if (panel._sfPatched) return;
    panel._sfPatched = true;

    var buttons = panel.querySelectorAll('button');
    buttons.forEach(function (btn) {
      // Replace onclick with our transition
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!document.getElementById('sf-overlay')) {
          buildOverlay();
        }
      }, true); // capture phase
    });
  }

  // ── MutationObserver: watch for done-panel becoming visible ───
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      // Style change → check if a panel became visible
      if (m.type === 'attributes') {
        var el = m.target;
        var d = el.style.display;
        var isPanel =
          el.id === 'done-panel' ||
          el.id === 'final-wrapper' ||
          el.id === 'final-panel' ||
          (el.className && el.className.toString().indexOf('done-panel') !== -1);
        if (isPanel && (d === 'flex' || d === 'block')) {
          patchPanel(el);
        }
      }
      // Child added → could be a dynamically created panel
      if (m.type === 'childList') {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (
            node.id === 'done-panel' ||
            node.id === 'final-wrapper' ||
            node.id === 'final-panel'
          ) {
            setTimeout(function () { patchPanel(node); }, 10);
          }
          // Also search inside
          var panels = node.querySelectorAll
            ? node.querySelectorAll('#done-panel, #final-wrapper, #final-panel')
            : [];
          panels.forEach(patchPanel);
        });
      }
    });
  });

  function init() {
    // Patch any already-visible panels
    ['done-panel', 'final-wrapper', 'final-panel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.display !== 'none') patchPanel(el);
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
