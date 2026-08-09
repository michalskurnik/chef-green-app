'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FILES = {
  mission2: path.join(__dirname, '..', 'www', 'free', 'mission2.html'),
  game3: path.join(__dirname, '..', 'www', 'italy', 'game3.html'),
};

const src = {};
for (const [name, p] of Object.entries(FILES)) src[name] = fs.readFileSync(p, 'utf8');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

for (const name of Object.keys(FILES)) {
  test(`${name}: no location.reload anywhere in the file`, () => {
    assert.ok(!/location\.reload/.test(src[name]), `${name} still contains location.reload`);
  });

  test(`${name}: lives<=0 branch calls setTimeout(showLose,600)`, () => {
    assert.ok(
      /if\(lives<=0\)\s*setTimeout\(showLose,600\)/.test(src[name]),
      `${name}: lives<=0 branch does not call setTimeout(showLose,600)`
    );
  });

  test(`${name}: showLose/resetGame/retryGame all exist`, () => {
    assert.ok(/function showLose\(\)/.test(src[name]), `${name}: showLose missing`);
    assert.ok(/function resetGame\(\)/.test(src[name]), `${name}: resetGame missing`);
    assert.ok(/function retryGame\(\)/.test(src[name]), `${name}: retryGame missing`);
  });

  test(`${name}: #loseOverlay markup and CSS toggle both exist`, () => {
    assert.ok(/id="loseOverlay"/.test(src[name]), `${name}: no #loseOverlay element`);
    assert.ok(/#loseOverlay\s*\{[^}]*display:none/.test(src[name]), `${name}: #loseOverlay default display:none missing`);
    assert.ok(/#loseOverlay\.show\s*\{[^}]*display:flex/.test(src[name]), `${name}: #loseOverlay.show display:flex missing`);
  });

  test(`${name}: retryGame() wired to a button`, () => {
    assert.ok(/onclick="retryGame\(\)"/.test(src[name]), `${name}: no onclick="retryGame()" button`);
  });

  test(`${name}: resetGame() clears score/lives/spawnTimer/items and sweeps stray DOM nodes`, () => {
    const m = src[name].match(/function resetGame\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(m, `${name}: resetGame() body not found`);
    const body = m[1];
    assert.ok(/score=0/.test(body.replace(/\s/g, '')), `${name}: resetGame() doesn't reset score`);
    assert.ok(/lives=3/.test(body.replace(/\s/g, '')), `${name}: resetGame() doesn't reset lives`);
    assert.ok(/spawnTimer=0/.test(body.replace(/\s/g, '')), `${name}: resetGame() doesn't reset spawnTimer`);
    assert.ok(/items=\[\]/.test(body.replace(/\s/g, '')), `${name}: resetGame() doesn't clear items`);
    assert.ok(/falling-item.*cloud.*catch-flash/.test(body), `${name}: resetGame() doesn't sweep .falling-item/.cloud/.catch-flash`);
    assert.ok(/0 \/ 10/.test(body), `${name}: resetGame() score text doesn't match the 10-item target`);
  });

  test(`${name}: showLose() sets gameRunning=false and cancels animFrame`, () => {
    const m = src[name].match(/function showLose\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(m, `${name}: showLose() body not found`);
    const body = m[1];
    assert.ok(/gameRunning=false/.test(body.replace(/\s/g, '')), `${name}: showLose() doesn't reset gameRunning`);
    assert.ok(/cancelAnimationFrame\(animFrame\)/.test(body), `${name}: showLose() doesn't cancel animFrame`);
    assert.ok(!/italy_stars/.test(body), `${name}: showLose() incorrectly writes stars on a loss`);
  });

  test(`${name}: retryGame() hides overlay then calls resetGame() before startGame()`, () => {
    const m = src[name].match(/function retryGame\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(m, `${name}: retryGame() body not found`);
    const body = m[1];
    assert.ok(/loseOverlay['"]\)\.classList\.remove\(['"]show['"]\)/.test(body), `${name}: retryGame() doesn't hide #loseOverlay`);
    const resetIdx = body.indexOf('resetGame()');
    const startIdx = body.indexOf('startGame()');
    assert.ok(resetIdx > -1 && startIdx > resetIdx, `${name}: retryGame() must call resetGame() before startGame()`);
  });

  test(`${name}: showWin() untouched by this change`, () => {
    const m = src[name].match(/function showWin\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(m, `${name}: showWin() not found`);
    assert.ok(!/loseOverlay|showLose/.test(m[1]), `${name}: showWin() was accidentally touched`);
  });
}

test('game3: showWin() still writes italy_stars_detail/italy_stars (untouched)', () => {
  const m = src.game3.match(/function showWin\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'game3: showWin() not found');
  assert.ok(/italy_stars_detail/.test(m[1]) && /italy_stars['"]/.test(m[1]), 'game3: showWin() no longer writes italy stars');
});

test('game3: showLose() does not write any italy_stars* localStorage key', () => {
  const m = src.game3.match(/function showLose\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'game3: showLose() not found');
  assert.ok(!/italy_stars/.test(m[1]), 'game3: showLose() incorrectly writes stars on a loss');
});

test('scope guard: mission1.html has no location.reload', () => {
  const p = path.join(__dirname, '..', 'www', 'free', 'mission1.html');
  assert.ok(!/location\.reload/.test(fs.readFileSync(p, 'utf8')), 'mission1.html unexpectedly contains location.reload');
});

test('scope guard: mission3.html has no location.reload', () => {
  const p = path.join(__dirname, '..', 'www', 'free', 'mission3.html');
  assert.ok(!/location\.reload/.test(fs.readFileSync(p, 'utf8')), 'mission3.html unexpectedly contains location.reload');
});

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
