'use strict';
/**
 * Tests the italy recipe-unlock sequencing against INTENDED behavior:
 * recipe i's two game pages should both write into italy_stars_detail[i],
 * so recipe i+1 only unlocks (and recipe i only shows "done") once
 * recipe i's own games are actually played.
 *
 * The write-index each game*.html uses is extracted from the real source
 * (not hardcoded), so these tests track reality: they fail red while the
 * cross-wiring bug is present and go green once the writes are fixed,
 * with no changes to this file either way.
 *
 * Zero dependencies - run with: node test/italy-unlock.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ITALY_DIR = path.join(__dirname, '..', 'www', 'italy');

// ── Fake localStorage (Node has none) ───────────────────────────────
function resetLocalStorage() {
  const store = {};
  global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
}
resetLocalStorage();

const unlockLogicPath = path.join(ITALY_DIR, 'unlock-logic.js');
delete require.cache[require.resolve(unlockLogicPath)];
const { isUnlocked, isDone, getDoneCount } = require(unlockLogicPath);

// ── Static extraction: which italy_stars_detail index does this game
//    file actually write on completion? Reads the real source so the
//    test can never drift from what's actually shipped. ────────────
function writtenIndexOf(gameFile) {
  const src = fs.readFileSync(path.join(ITALY_DIR, gameFile), 'utf8');
  const matches = [...src.matchAll(/\bd\[(\d+)\]/g)].map(m => Number(m[1]));
  assert.ok(matches.length > 0, `${gameFile}: found no italy_stars_detail write (d[N]) at all`);
  const unique = [...new Set(matches)];
  assert.strictEqual(
    unique.length, 1,
    `${gameFile}: writes ${unique.length} different indices (${unique.join(',')}) - ` +
    `this test assumes exactly one recipe slot per game file`
  );
  return unique[0];
}

// Intended mapping: recipe i (0-based) is played across two game files,
// and BOTH must write into slot i.
const INTENDED_INDEX = {
  'game1.html': 0, 'game2.html': 0,
  'game3.html': 1, 'game4.html': 1,
  'game5.html': 2, 'game6.html': 2,
  'game7.html': 3, 'game8.html': 3,
};
const COLLECTION_GAME = ['game1.html', 'game3.html', 'game5.html', 'game7.html']; // flat/first game of the pair
const ORDERING_GAME   = ['game2.html', 'game4.html', 'game6.html', 'game8.html']; // scored/second game of the pair

// Simulates "this game file's completion handler ran with this score",
// writing to whatever index the real file currently uses (bug and all).
function writeAsGame(gameFile, stars) {
  const idx = writtenIndexOf(gameFile);
  const d = JSON.parse(localStorage.getItem('italy_stars_detail') || '[]');
  while (d.length <= idx) d.push(0);
  d[idx] = stars;
  localStorage.setItem('italy_stars_detail', JSON.stringify(d));
}

// Simulates a player finishing BOTH of a recipe's games in order, the
// way the hub actually routes them (collection game, then ordering game).
function completeRecipeGames(recipeIndex, orderingStars) {
  writeAsGame(COLLECTION_GAME[recipeIndex], 3);
  writeAsGame(ORDERING_GAME[recipeIndex], orderingStars);
}

// "no recipe N unlocked while recipe N-1 is still locked"
function assertNoUnlockGap(label) {
  for (let i = 1; i < 4; i++) {
    assert.ok(
      !isUnlocked(i) || isUnlocked(i - 1),
      `${label}: recipe ${i + 1} is unlocked but recipe ${i} is still locked`
    );
  }
}

// ── Tiny zero-dependency test runner ────────────────────────────────
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('fresh state: only recipe 1 is unlocked', () => {
  resetLocalStorage();
  assert.strictEqual(isUnlocked(0), true,  'recipe 1 should be unlocked from the start');
  assert.strictEqual(isUnlocked(1), false, 'recipe 2 should be locked');
  assert.strictEqual(isUnlocked(2), false, 'recipe 3 should be locked');
  assert.strictEqual(isUnlocked(3), false, 'recipe 4 should be locked');
  assertNoUnlockGap('fresh state');
});

test('completing recipe 1\'s games marks it done, unlocks recipe 2, and nothing more', () => {
  resetLocalStorage();
  completeRecipeGames(0, 2); // recipe 1 = index 0

  assert.strictEqual(isDone(0), true,  'recipe 1 should be done');
  assert.strictEqual(isUnlocked(1), true, 'recipe 2 should unlock');

  assert.strictEqual(isDone(1), false,   'recipe 2 must NOT be marked done - its games were never played');
  assert.strictEqual(isUnlocked(2), false, 'recipe 3 must NOT unlock - recipe 2 was never played');
  assert.strictEqual(isDone(2), false);
  assert.strictEqual(isUnlocked(3), false, 'recipe 4 must NOT unlock');
  assert.strictEqual(isDone(3), false);
  assertNoUnlockGap('after recipe 1 only');
});

test('sequence 2 -> 3: completing recipe 2\'s games marks it done, unlocks recipe 3, nothing more', () => {
  resetLocalStorage();
  completeRecipeGames(0, 2); // finish recipe 1 first, as a real player would
  completeRecipeGames(1, 2); // then recipe 2

  assert.strictEqual(isDone(1), true,  'recipe 2 should be done');
  assert.strictEqual(isUnlocked(2), true, 'recipe 3 should unlock');

  assert.strictEqual(isDone(2), false,   'recipe 3 must NOT be marked done - its games were never played');
  assert.strictEqual(isUnlocked(3), false, 'recipe 4 must NOT unlock - recipe 3 was never played');
  assert.strictEqual(isDone(3), false);
  assertNoUnlockGap('after recipe 1 and 2');
});

test('sequence 3 -> 4: completing recipe 3\'s games marks it done, unlocks recipe 4, nothing more', () => {
  resetLocalStorage();
  completeRecipeGames(0, 2);
  completeRecipeGames(1, 2);
  completeRecipeGames(2, 2); // recipe 3

  assert.strictEqual(isDone(2), true,  'recipe 3 should be done');
  assert.strictEqual(isUnlocked(3), true, 'recipe 4 should unlock');

  assert.strictEqual(isDone(3), false, 'recipe 4 must NOT be marked done - its games were never played');
  assertNoUnlockGap('after recipe 1, 2 and 3');
});

test('trophy/all-done fires only after all 4 recipes are genuinely complete', () => {
  resetLocalStorage();
  completeRecipeGames(0, 2);
  completeRecipeGames(1, 2);
  completeRecipeGames(2, 2);
  assert.notStrictEqual(getDoneCount(), 4, 'trophy must not fire yet - recipe 4 was never played');

  completeRecipeGames(3, 2); // finally play recipe 4's own games
  assert.strictEqual(getDoneCount(), 4, 'trophy should fire once all 4 recipes are genuinely done');
});

test('trophy must not fire after playing only game1-4 (half the content)', () => {
  // The exact real-play trace from the bug report: a player who just
  // keeps hitting "next" through game1->game2->game3->game4 and never
  // opens game5-8 must not be told the adventure is complete.
  resetLocalStorage();
  writeAsGame('game1.html', 3);
  writeAsGame('game2.html', 2);
  writeAsGame('game3.html', 3);
  writeAsGame('game4.html', 2);

  assert.notStrictEqual(getDoneCount(), 4, 'trophy must not fire - recipes 3 and 4 were never played');
  assert.strictEqual(isDone(2), false, 'recipe 3 must not show done - game5/game6 never played');
  assert.strictEqual(isDone(3), false, 'recipe 4 must not show done - game7/game8 never played');
  assertNoUnlockGap('after game1-4 only');
});

test('each game file writes into its own recipe\'s slot', () => {
  for (const [file, expectedIndex] of Object.entries(INTENDED_INDEX)) {
    assert.strictEqual(
      writtenIndexOf(file), expectedIndex,
      `${file} should write italy_stars_detail[${expectedIndex}], not [${writtenIndexOf(file)}]`
    );
  }
});

// ── Run ──────────────────────────────────────────────────────────
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
  }
}
console.log('');
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exit(1);
