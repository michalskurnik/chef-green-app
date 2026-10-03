/**
 * dial-lab.js
 * Shared "מעבדת חוגה/מחוון" (dial/measuring-cup lab) engine for the STEM
 * package's three cup-comparison lab games: game1 (yeast), game7 (ice
 * cream freeze), game9 (volcano eruption) - per the spec's own "תבניות
 * משחק" list, template (1).
 *
 * Touch-only (no motion sensor - per "מגבלות ממשק"), no failure states
 * (per spec - there is always a "continue" path), illustrative results
 * only (not scientifically precise - drawn from each game's own resultCm
 * model, never randomised).
 *
 * A page using this engine sets window.LAB_CONFIG (shape documented
 * below) before loading this script, and must also load
 * stem-notebook-config.js and unlock-logic.js first (for the shared
 * prediction/result card ids and STATIONS metadata respectively).
 *
 * window.LAB_CONFIG = {
 *   gameNum:      Number,          // writes stem_game{gameNum}_completed
 *   stationIndex: Number,          // 0-indexed - matches STATIONS /
 *                                  // NOTEBOOK_STATIONS[stationIndex]
 *   title, emoji, color1, color2,  // header theming
 *   unit:      'ס״מ' | '°',        // measurement unit shown on the ruler
 *   maxScale:  Number,             // ruler's top value, for bar-height %
 *   varLabels: {key: 'שם המשתנה בעברית', ...}  // 1-2 named variables that
 *                                              // distinguish the cups, used
 *                                              // only to phrase the fair-
 *                                              // test note in level 2 - a
 *                                              // config with a single var
 *                                              // key never triggers that
 *                                              // note (nothing to conflate)
 *   guidedCups:    [{id,label,tag,vars:{...},resultCm}, ...]  (2-3 cups),
 *   freeExtraCups: [{...same shape}, ...]  (cups added in level 2),
 *   maxFreeRuns: Number,
 *   nextHref:  'gameN.html'        // the station's sorting game
 * }
 *
 * Cup ids in guidedCups must be the exact ids used by that station's
 * `cards` map in stem-notebook-config.js (prediction/result use the same
 * catalog) - this file writes stem_station{s}_prediction/_result with
 * those ids, never a new id of its own.
 *
 * Level 3 (the comprehension/conclusion step) is NOT configured here -
 * it always renders that station's own conclusionQ/conclusionCards from
 * StemNotebookConfig, so the notebook and the lab game show the exact
 * same fill-in-the-blank (single source of truth, see progress-keys.md).
 *
 * VISUAL DESIGN (per QA tasks 1218980468882124 / 1218980530772508 /
 * 1218980671925314 / 1218980574822409 / 1218982193949667 / 1218994178291012):
 * each cup renders a small illustrated "vessel" watermark (which container
 * this station uses - cup/bag/volcano-cup, from assets/props/) plus a row
 * of variable icons (per-gameNum mapping in varIconsHtml below) so kids can
 * tell cups apart at a glance, not just by reading the tag text. The free
 * -choice screen reuses the same illustrated cup card (no more text-only
 * chip list). The conclusion step now actually blocks on a wrong pick
 * (shake + "נסו שוב") instead of always advancing.
 */
(function () {
  'use strict';

  var CFG = window.LAB_CONFIG;
  var NB  = window.StemNotebookConfig.NOTEBOOK_STATIONS[CFG.stationIndex];
  var STATION_NUM = CFG.stationIndex + 1;

  var root = document.getElementById('lab-root');

  var state = {
    level: 1,
    prediction: null,
    guidedRun: false,
    freeRunsUsed: 0,
    freeSelected: [],
    conclusion: null
  };

  function allCupsPool() {
    return CFG.guidedCups.concat(CFG.freeExtraCups || []);
  }

  function cupById(id) {
    var pool = allCupsPool();
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
    return null;
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function setLevelBadge() {
    var b = document.getElementById('level-badge');
    if (b) b.textContent = 'שלב ' + state.level + ' מתוך 3';
  }

  // ── Hint-trigger button (prominent, glowing pill - injects its own
  // style once, so any game setting CFG.hintComic gets it for free) ───
  function ensureHintTriggerStyle() {
    if (document.getElementById('hint-trigger-style')) return;
    var css =
      '.hint-trigger-wrap{display:flex;justify-content:center;margin:2px 0 18px}' +
      '.hint-trigger{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;' +
      'border-radius:30px;border:2px solid #F7C948;background:linear-gradient(135deg,#FFF6DD,#FFE9AE);' +
      'color:#8a6412;font-family:\'Fredoka One\',cursive;font-size:15px;cursor:pointer;position:relative;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.1);animation:hintPulse 2.2s ease-in-out infinite}' +
      '.hint-trigger:active{transform:scale(.96)}' +
      '.hint-trigger .hint-emoji{font-size:21px;display:inline-block;animation:hintBulbGlow 1.8s ease-in-out infinite}' +
      '.hint-trigger .hint-spark{position:absolute;font-size:13px;pointer-events:none;opacity:0;' +
      'animation:hintSparkTwinkle 2.4s ease-in-out infinite}' +
      '.hint-trigger .hint-spark.s1{top:-8px;right:8px;animation-delay:.2s}' +
      '.hint-trigger .hint-spark.s2{bottom:-7px;left:12px;animation-delay:1.1s}' +
      '.hint-trigger .hint-spark.s3{top:2px;left:-10px;animation-delay:.7s;font-size:11px}' +
      '@keyframes hintPulse{0%,100%{box-shadow:0 0 0 0 rgba(247,201,72,.55),0 4px 14px rgba(0,0,0,.1)}' +
      '50%{box-shadow:0 0 0 10px rgba(247,201,72,0),0 4px 14px rgba(0,0,0,.1)}}' +
      '@keyframes hintBulbGlow{0%,100%{filter:drop-shadow(0 0 0px #F7C948)}50%{filter:drop-shadow(0 0 6px #F7C948)}}' +
      '@keyframes hintSparkTwinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0deg)}' +
      '50%{opacity:1;transform:scale(1.15) rotate(18deg)}}';
    var style = document.createElement('style');
    style.id = 'hint-trigger-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Per-game illustration mapping ──────────────────────────────────
  // Earlier version drew a semi-transparent "vessel" watermark (cup/bag
  // PNG) behind the liquid. Dropped: those PNGs are mostly clear glass /
  // white plastic, so at the low opacity needed to not fight the liquid
  // color they were nearly invisible on the white card - it read as "no
  // illustration at all" rather than "glass". The plain CSS glass shape
  // (.cup-visual's border) plus a painted highlight streak now IS the
  // glass, and each cup's variable icons are shown as solid, high-
  // contrast badges (not washed-out watermarks) so kids can tell cups
  // apart at a glance.
  function varIconsHtml(cup) {
    var gn = CFG.gameNum;
    var imgs = [];

    if (gn === 1) {
      var temp = (cup.vars && cup.vars.temp) || 'warm';
      imgs.push({ src: 'stem_prop_thermometer.png', cls: 'temp-' + temp, alt: 'טמפרטורה' });
      var hasSugar = !!(cup.vars && cup.vars.sugar);
      imgs.push({
        src: hasSugar ? 'stem_prop_bubble_medium.png' : 'stem_prop_bubble_small.png',
        cls: hasSugar ? '' : 'dim',
        alt: 'סוכר'
      });
    } else if (gn === 7) {
      var salt = (cup.vars && cup.vars.salt) || 0;
      var n = Math.max(salt, 1);
      for (var i = 0; i < n; i++) {
        imgs.push({ src: 'stem_prop_salt_spoon.png', cls: salt === 0 ? 'dim' : '', alt: 'מלח' });
      }
    } else if (gn === 9) {
      var soda = (cup.vars && cup.vars.soda) || 'tsp';
      var sodaImg = soda === 'tsp' ? 'stem_prop_soda_spoon_small.png' : 'stem_prop_soda_spoon_large.png';
      var sodaCount = soda === '2tbsp' ? 2 : 1;
      for (var j = 0; j < sodaCount; j++) imgs.push({ src: sodaImg, cls: '', alt: 'סודה' });
      var vinMap = { 50: 'stem_prop_vinegar_low.png', 100: 'stem_prop_vinegar_medium.png', 150: 'stem_prop_vinegar_full.png' };
      var vinegar = (cup.vars && cup.vars.vinegar) || 100;
      imgs.push({ src: vinMap[vinegar] || 'stem_prop_vinegar_medium.png', cls: '', alt: 'חומץ' });
    }

    if (!imgs.length) return '';
    var html = '<div class="var-icons">';
    imgs.forEach(function (im) {
      html += '<span class="var-icon-badge ' + im.cls + '"><img class="var-icon" src="assets/props/' + im.src + '" alt="' + im.alt + '"></span>';
    });
    html += '</div>';
    return html;
  }

  // ── Level 1: guided ────────────────────────────────────────────────
  function renderGuided() {
    state.level = 1;
    setLevelBadge();
    root.innerHTML = '';

    var intro = el('p', 'lab-intro', NB.predictionQ + ' הקישו על הכוס שלדעתכם תעלה הכי גבוה, ואז לחצו התחילו!');
    root.appendChild(intro);

    var row = el('div', 'cup-row');
    CFG.guidedCups.forEach(function (cup) {
      row.appendChild(buildCupCard(cup, 'guided'));
    });
    root.appendChild(row);

    var startBtn = el('button', 'lab-btn primary', '▶️ התחילו!');
    startBtn.id = 'start-guided-btn';
    startBtn.disabled = true;
    startBtn.onclick = runGuided;
    root.appendChild(startBtn);
  }

  // mode: 'guided' (single-pick, prediction) | 'free' (multi-pick up to 2)
  // | null (read-only display, used inside the running/result state)
  function buildCupCard(cup, mode) {
    var card = el('div', 'cup-card');
    card.dataset.id = cup.id;

    var vis = el('div', 'cup-visual');
    var liquid = el('div', 'cup-liquid');
    liquid.style.height = '0%';
    vis.appendChild(liquid);
    var ruler = el('div', 'cup-ruler');
    for (var t = 0; t < 4; t++) ruler.appendChild(el('div', 'tick'));
    vis.appendChild(ruler);
    var bubbles = el('div', 'cup-bubbles');
    vis.appendChild(bubbles);
    card.appendChild(vis);

    var iconsHtml = varIconsHtml(cup);
    if (iconsHtml) card.insertAdjacentHTML('beforeend', iconsHtml);

    card.appendChild(el('div', 'cup-label', cup.label));
    card.appendChild(el('div', 'cup-tag', cup.tag));
    var readout = el('div', 'cup-readout', '');
    card.appendChild(readout);

    if (mode === 'guided') {
      card.classList.add('selectable');
      if (state.prediction === cup.id) card.classList.add('picked');
      card.onclick = function () {
        if (state.guidedRun) return;
        document.querySelectorAll('.cup-row .cup-card').forEach(function (c) { c.classList.remove('picked'); });
        card.classList.add('picked');
        state.prediction = cup.id;
        var btn = document.getElementById('start-guided-btn');
        if (btn) btn.disabled = false;
      };
    } else if (mode === 'free') {
      card.classList.add('selectable');
      if (state.freeSelected.indexOf(cup.id) > -1) {
        card.classList.add('picked');
        card.appendChild(el('div', 'pick-check', '✓'));
      }
      card.onclick = function () {
        var idx = state.freeSelected.indexOf(cup.id);
        if (idx > -1) {
          state.freeSelected.splice(idx, 1);
        } else {
          if (state.freeSelected.length >= 2) state.freeSelected.shift();
          state.freeSelected.push(cup.id);
        }
        renderFreeGrid();
      };
    }
    return card;
  }

  function animateCup(cardEl, cup, onDone) {
    cardEl.querySelector('.cup-visual').classList.add('bubbling');
    setTimeout(function () {
      cardEl.querySelector('.cup-visual').classList.remove('bubbling');
      var pct = Math.min(100, Math.round((cup.resultCm / CFG.maxScale) * 100));
      cardEl.querySelector('.cup-liquid').style.height = pct + '%';
      var readout = cardEl.querySelector('.cup-readout');
      readout.textContent = cup.resultCm + ' ' + CFG.unit;
      readout.classList.add('show');
      if (onDone) onDone();
    }, 1600);
  }

  function runGuided() {
    if (state.guidedRun) return;
    state.guidedRun = true;
    document.getElementById('start-guided-btn').disabled = true;
    document.getElementById('start-guided-btn').textContent = '⏳ מודדים...';

    var cards = document.querySelectorAll('.cup-row .cup-card');
    var done = 0;
    cards.forEach(function (cardEl) {
      var cup = cupById(cardEl.dataset.id);
      animateCup(cardEl, cup, function () {
        done++;
        if (done === cards.length) finishGuided();
      });
    });
  }

  function finishGuided() {
    var winner = CFG.guidedCups.slice().sort(function (a, b) { return b.resultCm - a.resultCm; })[0];
    localStorage.setItem('stem_station' + STATION_NUM + '_prediction', state.prediction);
    localStorage.setItem('stem_station' + STATION_NUM + '_result', winner.id);

    var matchLine = el('p', 'lab-match',
      (state.prediction === winner.id)
        ? '🎉 ניחשתם בדיוק! כוס ' + winner.label.replace('כוס ', '') + ' עלתה הכי גבוה.'
        : '🤔 יצא אחרת מהניחוש — כוס ' + winner.label.replace('כוס ', '') + ' היא זו שעלתה הכי גבוה!');
    root.appendChild(matchLine);

    var nextBtn = el('button', 'lab-btn primary', 'בואו נגלה עוד →');
    nextBtn.onclick = renderFree;
    root.appendChild(nextBtn);
  }

  // ── Level 2: free exploration ─────────────────────────────────────
  function fairTestNote(a, b) {
    if (!a || !b) return '';
    var labels = CFG.varLabels || {};
    var keys = Object.keys(labels);
    var diffs = [];
    keys.forEach(function (k) {
      if (a.vars[k] !== b.vars[k]) diffs.push(labels[k]);
    });
    if (diffs.length >= 2) {
      return '🤔 ' + a.label + ' ו' + b.label + ' שונות בכמה דברים (' + diffs.join(' ו') + ') — קשה לדעת מה גרם להבדל!';
    }
    if (diffs.length === 1) {
      return '👍 מבחן הוגן — רק ה' + diffs[0] + ' משתנה בין ' + a.label + ' ל' + b.label + '.';
    }
    return '';
  }

  function renderFree() {
    state.level = 2;
    setLevelBadge();
    root.innerHTML = '';

    root.appendChild(el('p', 'lab-intro', 'עכשיו הקישו על 2 כוסות כדי לבחור אותן להשוואה, ואז לחצו השוו! ⚖️'));

    var note = el('p', 'lab-note');
    note.id = 'fair-test-note';
    root.appendChild(note);

    var row = el('div', 'cup-row free-grid');
    row.id = 'free-cup-row';
    root.appendChild(row);

    var runInfo = el('div', 'run-info');
    runInfo.id = 'run-info';
    root.appendChild(runInfo);

    var compareBtn = el('button', 'lab-btn primary', '⚖️ השוו!');
    compareBtn.id = 'compare-btn';
    compareBtn.disabled = true;
    compareBtn.onclick = runFree;
    root.appendChild(compareBtn);

    var skipBtn = el('button', 'lab-btn ghost', 'למדתי מספיק — להבנה ←');
    skipBtn.onclick = renderConclusion;
    root.appendChild(skipBtn);

    renderFreeGrid();
  }

  function renderFreeGrid() {
    var row = document.getElementById('free-cup-row');
    row.innerHTML = '';
    allCupsPool().forEach(function (cup) {
      row.appendChild(buildCupCard(cup, 'free'));
    });

    var noteEl = document.getElementById('fair-test-note');
    var a = cupById(state.freeSelected[0]), b = cupById(state.freeSelected[1]);
    noteEl.textContent = fairTestNote(a, b);

    var btn = document.getElementById('compare-btn');
    var runsLeft = CFG.maxFreeRuns - state.freeRunsUsed;
    var selCount = state.freeSelected.length;
    var runInfoEl = document.getElementById('run-info');
    var selText = selCount === 2 ? '✅ 2/2 כוסות נבחרו' : ('נבחרו ' + selCount + ' מתוך 2 כוסות');
    runInfoEl.textContent = runsLeft > 0
      ? (selText + ' · נשארו ' + runsLeft + ' הרצות מתוך ' + CFG.maxFreeRuns)
      : 'ניסיתם את כל ההרצות להיום — יופי של חקירה!';
    btn.disabled = selCount !== 2 || runsLeft <= 0;
  }

  function runFree() {
    if (state.freeSelected.length !== 2) return;
    document.getElementById('compare-btn').disabled = true;
    state.freeRunsUsed++;
    var done = 0;
    var cards = [];
    state.freeSelected.forEach(function (id) {
      var cardEl = document.querySelector('#free-cup-row .cup-card[data-id="' + id + '"]');
      if (cardEl) cards.push(cardEl);
    });
    cards.forEach(function (cardEl) {
      var cup = cupById(cardEl.dataset.id);
      animateCup(cardEl, cup, function () {
        done++;
        if (done === cards.length) renderFreeGrid();
      });
    });
  }

  // ── Level 3: conclusion (shared with the notebook) ─────────────────
  function renderConclusion() {
    state.level = 3;
    setLevelBadge();
    root.innerHTML = '';

    root.appendChild(el('p', 'lab-intro', NB.conclusionQ));

    if (CFG.hintComic && window.openHintComic) {
      ensureHintTriggerStyle();
      var hintWrap = el('div', 'hint-trigger-wrap');
      var hintBtn = el('button', 'hint-trigger',
        '<span class="hint-spark s1">✨</span>' +
        '<span class="hint-spark s3">✨</span>' +
        '<span class="hint-emoji">💡</span>' +
        '<span>לא בטוחים? רמז</span>' +
        '<span class="hint-spark s2">✨</span>');
      hintBtn.onclick = function () { window.openHintComic(CFG.hintComic); };
      hintWrap.appendChild(hintBtn);
      root.appendChild(hintWrap);
    }

    var msg = el('p', 'lab-note conclusion-msg');
    msg.id = 'conclusion-msg';
    root.appendChild(msg);

    var row = el('div', 'conclusion-row');
    Object.keys(NB.conclusionCards).forEach(function (id) {
      var c = NB.conclusionCards[id];
      var card = el('div', 'conclusion-card', '<span class="cc-icon">' + c.icon + '</span><span class="cc-label">' + c.label + '</span>');
      card.onclick = function () {
        if (state.conclusion) return;
        if (c.correct) {
          state.conclusion = id;
          localStorage.setItem('stem_station' + STATION_NUM + '_conclusion', id);
          document.querySelectorAll('.conclusion-card').forEach(function (cc) { cc.classList.remove('wrong'); });
          card.classList.add('picked', 'correct-pick');
          msg.textContent = '🎉 בדיוק! מצוין!';
          setTimeout(finishGame, 700);
        } else {
          card.classList.remove('wrong');
          void card.offsetWidth; // restart animation if clicked twice in a row
          card.classList.add('wrong');
          msg.textContent = '🤔 לא בדיוק — נסו שוב!';
          setTimeout(function () { card.classList.remove('wrong'); }, 500);
        }
      };
      row.appendChild(card);
    });
    root.appendChild(row);
  }

  function finishGame() {
    localStorage.setItem('stem_game' + CFG.gameNum + '_completed', '1');
    root.innerHTML = '';
    var done = el('div', 'lab-done');
    done.innerHTML =
      '<div class="lab-done-emoji">🎉</div>' +
      '<p class="lab-done-title">מעולה! גיליתם המון על ' + CFG.title + '</p>' +
      '<button class="lab-btn primary" id="to-sorting-btn">🧩 בואו נרכיב את הניסוי</button>' +
      '<button class="lab-btn ghost" id="to-hub-btn">🏠 חזרה להאב</button>';
    root.appendChild(done);
    document.getElementById('to-sorting-btn').onclick = function () { window.location.href = CFG.nextHref; };
    document.getElementById('to-hub-btn').onclick = function () { window.location.href = 'index.html'; };
  }

  document.addEventListener('DOMContentLoaded', renderGuided);
})();
