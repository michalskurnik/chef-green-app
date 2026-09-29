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

  // ── Level 1: guided ────────────────────────────────────────────────
  function renderGuided() {
    state.level = 1;
    setLevelBadge();
    root.innerHTML = '';

    var intro = el('p', 'lab-intro', NB.predictionQ + ' הקישו על הכוס שלדעתכם תעלה הכי גבוה, ואז לחצו התחילו!');
    root.appendChild(intro);

    var row = el('div', 'cup-row');
    CFG.guidedCups.forEach(function (cup) {
      row.appendChild(buildCupCard(cup, true));
    });
    root.appendChild(row);

    var startBtn = el('button', 'lab-btn primary', '▶️ התחילו!');
    startBtn.id = 'start-guided-btn';
    startBtn.disabled = true;
    startBtn.onclick = runGuided;
    root.appendChild(startBtn);
  }

  function buildCupCard(cup, selectable) {
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

    card.appendChild(el('div', 'cup-label', cup.label));
    card.appendChild(el('div', 'cup-tag', cup.tag));
    var readout = el('div', 'cup-readout', '');
    card.appendChild(readout);

    if (selectable) {
      card.classList.add('selectable');
      card.onclick = function () {
        if (state.guidedRun) return;
        document.querySelectorAll('.cup-row .cup-card').forEach(function (c) { c.classList.remove('picked'); });
        card.classList.add('picked');
        state.prediction = cup.id;
        var btn = document.getElementById('start-guided-btn');
        if (btn) btn.disabled = false;
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

    root.appendChild(el('p', 'lab-intro', 'עכשיו בחרו שתי כוסות להשוואה (מתוך כל הכוסות), ולחצו השוו!'));

    var pool = allCupsPool();
    var chips = el('div', 'chip-row');
    pool.forEach(function (cup) {
      var chip = el('button', 'cup-chip', cup.label + ' — ' + cup.tag);
      chip.dataset.id = cup.id;
      chip.onclick = function () {
        var idx = state.freeSelected.indexOf(cup.id);
        if (idx > -1) {
          state.freeSelected.splice(idx, 1);
        } else {
          if (state.freeSelected.length >= 2) state.freeSelected.shift();
          state.freeSelected.push(cup.id);
        }
        renderFreeSelection();
      };
      chips.appendChild(chip);
    });
    root.appendChild(chips);

    var note = el('p', 'lab-note');
    note.id = 'fair-test-note';
    root.appendChild(note);

    var row = el('div', 'cup-row');
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

    renderFreeSelection();
  }

  function renderFreeSelection() {
    document.querySelectorAll('.cup-chip').forEach(function (chip) {
      chip.classList.toggle('picked', state.freeSelected.indexOf(chip.dataset.id) > -1);
    });
    var noteEl = document.getElementById('fair-test-note');
    var a = cupById(state.freeSelected[0]), b = cupById(state.freeSelected[1]);
    noteEl.textContent = fairTestNote(a, b);

    var row = document.getElementById('free-cup-row');
    row.innerHTML = '';
    state.freeSelected.forEach(function (id) {
      row.appendChild(buildCupCard(cupById(id), false));
    });

    var btn = document.getElementById('compare-btn');
    var runsLeft = CFG.maxFreeRuns - state.freeRunsUsed;
    document.getElementById('run-info').textContent = runsLeft > 0
      ? ('נשארו ' + runsLeft + ' הרצות מתוך ' + CFG.maxFreeRuns)
      : 'ניסיתם את כל ההרצות להיום — יופי של חקירה!';
    btn.disabled = state.freeSelected.length !== 2 || runsLeft <= 0;
  }

  function runFree() {
    var cards = document.querySelectorAll('#free-cup-row .cup-card');
    if (!cards.length) return;
    document.getElementById('compare-btn').disabled = true;
    state.freeRunsUsed++;
    var done = 0;
    cards.forEach(function (cardEl) {
      var cup = cupById(cardEl.dataset.id);
      animateCup(cardEl, cup, function () {
        done++;
        if (done === cards.length) renderFreeSelection();
      });
    });
  }

  // ── Level 3: conclusion (shared with the notebook) ─────────────────
  function renderConclusion() {
    state.level = 3;
    setLevelBadge();
    root.innerHTML = '';

    root.appendChild(el('p', 'lab-intro', NB.conclusionQ));

    var row = el('div', 'conclusion-row');
    Object.keys(NB.conclusionCards).forEach(function (id) {
      var c = NB.conclusionCards[id];
      var card = el('div', 'conclusion-card', '<span class="cc-icon">' + c.icon + '</span><span class="cc-label">' + c.label + '</span>');
      card.onclick = function () {
        if (state.conclusion) return;
        state.conclusion = id;
        localStorage.setItem('stem_station' + STATION_NUM + '_conclusion', id);
        document.querySelectorAll('.conclusion-card').forEach(function (cc) { cc.classList.remove('picked'); });
        card.classList.add('picked');
        if (c.correct) card.classList.add('correct-pick');
        setTimeout(finishGame, 700);
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
