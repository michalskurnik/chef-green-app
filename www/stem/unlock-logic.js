/**
 * Pure station-unlock decision logic + station metadata for the STEM
 * ("ניסויים במטבח") hub. Loaded as a classic <script> by stem/index.html
 * and require()-able directly from Node tests (same dual-export pattern
 * as italy/unlock-logic.js).
 *
 * Per the package spec (Asana project notes -> "אפיון חבילת ניסויים
 * במטבח"): 5 stations - 4 regular experiments + one locked "extra"
 * (הר געש / volcano), which unlocks once the 4 regular stations are all
 * done. Each station owns exactly 2 games (a lab/measuring game + a
 * sorting/assembly game), so games are numbered 1..10 sequentially in
 * station order: station index i (0-based, like italy's RECIPES) owns
 * games (2i+1) and (2i+2).
 *
 * Unlock order (confirmed with Michal, matches the spec's own proposal):
 * stations 0-3 (the 4 regular ones) unlock sequentially, one at a time -
 * same rule as italy/unlock-logic.js's isUnlocked (station 0 always open,
 * station i opens once station i-1 is done). The extra station (index 4)
 * opens only once all 4 regular stations are done.
 *
 * The certificate (completion.html) is awarded after the 4 regular
 * stations alone - the extra/volcano station does NOT count toward it
 * (per spec: "התחנה ה-5 (הר געש) לא נספרת בתנאי הפתיחה של התעודה"). So
 * "all 4 regular stations done" is exposed as its own function
 * (mainStationsDone) rather than folded into isAllComplete, which needs
 * all 5 for the fully-finished state (used for the 5th/gold sticker on
 * final_screen.html).
 *
 * Storage contract (one writer, one reader per key - see
 * docs/progress-keys.md "Contract for package 4"):
 *   stem_game{n}_completed (n=1..10) - written by game{n}.html itself;
 *   read here (station completion) and by the hub (per-game checkmarks).
 * This module is a READER ONLY - it never writes any key.
 */
(function () {
  'use strict';

  // Station metadata - name/emoji/color/entry page. Purely presentational,
  // kept alongside the logic the same way italy/unlock-logic.js keeps its
  // RECIPES array next to isUnlocked/isDone. Names are exactly as they
  // appear in the package spec.
  var STATIONS = [
    { name: 'לחמניות שמרים', emoji: '🍞', color: '#C68C46', href: 'game1.html' },
    { name: 'ריבת תותים',    emoji: '🍓', color: '#C62839', href: 'game3.html' },
    { name: 'כרוב סגול',     emoji: '🥬', color: '#7B2D8B', href: 'game5.html' },
    { name: 'גלידה בשקית',   emoji: '🍦', color: '#2E9BC6', href: 'game7.html' },
    { name: 'הר געש',        emoji: '🌋', color: '#D9531E', href: 'game9.html', extra: true }
  ];

  var GAMES_PER_STATION = 2;
  var TOTAL_GAMES        = STATIONS.length * GAMES_PER_STATION;
  var EXTRA_INDEX         = STATIONS.length - 1; // index 4 - the locked "extra" station

  function gameCompleted(n) {
    return (typeof localStorage !== 'undefined')
      && localStorage.getItem('stem_game' + n + '_completed') === '1';
  }

  // [labGameNumber, sortingGameNumber] owned by station i (0-indexed).
  function stationGameNumbers(i) {
    var first = i * GAMES_PER_STATION + 1;
    return [first, first + 1];
  }

  function isStationDone(i) {
    var nums = stationGameNumbers(i);
    return gameCompleted(nums[0]) && gameCompleted(nums[1]);
  }

  // True once all 4 regular stations (indices 0..EXTRA_INDEX-1) are done -
  // the certificate-eligibility condition, and also the extra station's
  // unlock condition.
  function mainStationsDone() {
    for (var i = 0; i < EXTRA_INDEX; i++) {
      if (!isStationDone(i)) return false;
    }
    return true;
  }

  function isStationUnlocked(i) {
    if (i === 0) return true;
    if (i === EXTRA_INDEX) return mainStationsDone();
    return isStationDone(i - 1);
  }

  function getDoneCount() {
    var n = 0;
    for (var i = 0; i < STATIONS.length; i++) if (isStationDone(i)) n++;
    return n;
  }

  function getCompletedGamesCount() {
    var n = 0;
    for (var g = 1; g <= TOTAL_GAMES; g++) if (gameCompleted(g)) n++;
    return n;
  }

  // All 5 stations done, including the extra/volcano one (the "5th gold
  // sticker" state on final_screen.html) - stricter than mainStationsDone.
  function isAllComplete() {
    return getDoneCount() === STATIONS.length;
  }

  var api = {
    STATIONS: STATIONS,
    GAMES_PER_STATION: GAMES_PER_STATION,
    TOTAL_GAMES: TOTAL_GAMES,
    EXTRA_INDEX: EXTRA_INDEX,
    gameCompleted: gameCompleted,
    stationGameNumbers: stationGameNumbers,
    isStationDone: isStationDone,
    isStationUnlocked: isStationUnlocked,
    mainStationsDone: mainStationsDone,
    getDoneCount: getDoneCount,
    getCompletedGamesCount: getCompletedGamesCount,
    isAllComplete: isAllComplete
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.StemUnlockLogic = api;
  }
})();
