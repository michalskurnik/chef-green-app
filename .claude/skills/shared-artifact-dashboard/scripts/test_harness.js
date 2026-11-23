// Starter test suite for a board built from assets/board-template.html.
// Copy it next to your build as suite.js, then extend: one numbered test per behaviour, each in its own { } block.
//   node suite.js <built.html> > runNN.txt ; grep -v '^PASS' runNN.txt ; grep -c '^PASS' runNN.txt
// Needs Playwright (preinstalled in claude.ai cloud sessions: require('playwright') works from any folder).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { wrap, init, fire } = require(path.join(__dirname, 'mock_runtime.js'));
const built = process.argv[2] || 'board.html';
const page = path.resolve(path.dirname(built), 'suite.html');
fs.writeFileSync(page, wrap(fs.readFileSync(built, 'utf8')));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const b = await chromium.launch();
  const fresh = async (w = 1440, extra = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, ...extra });
    await ctx.addInitScript(init);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('PAGEERROR', e.message); fails++; });
    await p.goto('file://' + page); await p.waitForTimeout(700);
    return [ctx, p];
  };
  let [ctx, p] = await fresh();

  // 1. loads and renders the seed
  {
    const n = await p.$$eval('#items .item', e => e.length);
    const h1 = await p.textContent('.ovr-top h1');
    ok(n >= 0 && h1.length > 0, '1 page renders (title "' + h1 + '", ' + n + ' cards)');
  }

  // 2. creating a task writes it and shows a SYM-n key
  {
    await p.click('#btn-create'); await p.fill('#f-title', 'test task'); await p.click('#f-submit'); await p.waitForTimeout(500);
    const w = await p.evaluate(() => __w.filter(x => x[0] === 'add' && x[1] === 'items').map(x => x[2]));
    const key = await p.evaluate(() => [...document.querySelectorAll('#items .item')].map(x => x.textContent).find(t => t.includes('test task')) || '');
    ok(w.includes('test task') && /[A-Z][A-Z0-9]{1,4}-\d+/.test(key), '2 create task: written and shown with a key');
  }

  // 3. versions menu survives resize events and a data refresh while hovering
  {
    await ctx.close(); [ctx, p] = await fresh();
    await p.click('#relpanel .vb-pick'); await p.waitForTimeout(100);
    const box = await p.$eval('#vb-menu .rel.add', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; });
    for (let k = 0; k < 8; k++) { await p.mouse.move(box.x + 8 + k * 10, box.y + box.h / 2); await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await p.waitForTimeout(25); }
    await fire(p, 'items'); await p.waitForTimeout(150);
    ok(!!(await p.$('#vb-menu .rel.add')), '3 versions menu stays open through resizes and a refresh');
  }

  // 4. filters highlight when changed and "clear" resets them
  {
    await ctx.close(); [ctx, p] = await fresh();
    await p.selectOption('#flt-type', 'bug'); await p.waitForTimeout(150);
    const on = await p.$eval('#flt-type', e => e.parentNode.classList.contains('on'));
    const clr = await p.$eval('#flt-clear', e => !e.hidden);
    await p.click('#flt-clear'); await p.waitForTimeout(150);
    ok(on && clr && (await p.inputValue('#flt-type')) === '' && (await p.$eval('#flt-clear', e => e.hidden)), '4 filter highlight + clear');
  }

  // 5. layout: both rows on one line, uniform heights, no horizontal scroll (desktop widths)
  for (const w of [1280, 1440, 1600, 1920]) {
    await ctx.close(); [ctx, p] = await fresh(w);
    const r = await p.evaluate(() => {
      const cy = s => { const x = document.querySelector(s).getBoundingClientRect(); return Math.round((x.top + x.bottom) / 2); };
      const top = ['.ovr-top h1', '#relpanel .verbar', '#q', '#view'].map(cy);
      const row2 = [...document.querySelectorAll('#fbar .fdd')].map(e => { const x = e.getBoundingClientRect(); return Math.round((x.top + x.bottom) / 2); });
      const hs = [...document.querySelectorAll('#fbar .fdd, #q, #btn-create, #view')].map(e => Math.round(e.getBoundingClientRect().height));
      return { top: new Set(top).size, row2: new Set(row2).size, heights: [...new Set(hs)], over: document.documentElement.scrollWidth > innerWidth };
    });
    ok(r.top === 1 && r.row2 === 1 && r.heights.length === 1 && !r.over, '5 ' + w + ' wide: one-line rows, uniform 30px controls ' + JSON.stringify(r));
  }

  // 6. phone: no sideways scroll, no squeezed dropdown
  {
    await ctx.close(); [ctx, p] = await fresh(390);
    const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth,
      squeezed: [...document.querySelectorAll('#fbar select')].filter(s => s.offsetWidth && s.scrollWidth > s.clientWidth + 1).length }));
    ok(!r.over && r.squeezed === 0, '6 phone: fits, nothing squeezed ' + JSON.stringify(r));
  }

  // 7. an active filter (the "clear" button shows) keeps the filter row on one line
  for (const w of [1280, 1440]) {
    await ctx.close(); [ctx, p] = await fresh(w);
    await p.selectOption('#flt-type', 'bug'); await p.waitForTimeout(150);
    const lines = await p.evaluate(() => new Set([...document.querySelectorAll('#fbar .fdd, #flt-clear, #tt-items')].filter(e => e.offsetWidth)
      .map(e => { const x = e.getBoundingClientRect(); return Math.round((x.top + x.bottom) / 2); })).size);
    ok(lines === 1, '7 ' + w + ' wide: filter row stays on one line with a filter active (' + lines + ' line(s))');
  }

  // 8. expanded card: equal centered buttons; close button, outside click and Escape close it; inner clicks do not
  {
    await ctx.close(); [ctx, p] = await fresh();
    await p.click('#view button:has-text("רשימה")'); await p.waitForTimeout(200);
    await p.click('#items .card.item >> nth=0 >> summary'); await p.waitForTimeout(150);
    const open = () => p.evaluate(() => !!document.querySelector('#items .card.item>details[open]'));
    const ws = await p.$$eval('#items .card.item.is-open .acts>button, #items .card.item.is-open .acts>.btn', e => [...new Set(e.filter(x => x.offsetWidth).map(x => Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height)))]);
    await p.click('#items .card.item.is-open textarea >> nth=0'); const inside = await open();
    await p.click('.ovr-top h1'); const outside = !(await open());
    await p.click('#items .card.item >> nth=0 >> summary'); await p.keyboard.press('Escape'); const esc = !(await open());
    await p.click('#items .card.item >> nth=0 >> summary'); await p.click('#items .card.item.is-open .card-close'); const btn = !(await open());
    ok(ws.length === 1 && inside && outside && esc && btn, '8 card: one button size ' + JSON.stringify(ws) + ', inner click keeps it open, outside click / Escape / close button close it');
  }

  // 9. live-data health: an older saved copy never overrides newer data; a stale view is flagged; a dead subscription recovers
  {
    await ctx.close(); [ctx, p] = await fresh();
    const id = await p.evaluate(() => document.querySelector('#items .card.item').dataset.id);
    const pills = () => p.evaluate((id) => [...document.querySelector('#items .card.item[data-id="' + id + '"]').querySelectorAll('.pill')].map(x => x.textContent).join('|'), id);
    const stale = () => p.evaluate(() => document.querySelector('.ovr-top .logo').classList.contains('stale'));
    const before = await pills();
    await fire(p, 'items', { [id]: { status: 'wont', updatedAt: '2000-01-01T00:00:00Z' } }, true); await fire(p, 'releases', {}, true); await p.waitForTimeout(200);
    const a = (await pills()) === before;
    await p.waitForTimeout(12300); const bFlag = await stale();
    await fire(p, 'items', {}, false); await fire(p, 'releases', {}, false); await p.waitForTimeout(200); const cFlag = !(await stale());
    const s0 = await p.evaluate(() => window.__subs); await p.evaluate(() => window.__snapErr.items({ code: 'unavailable' })); await p.waitForTimeout(200); const dFlag = !(await stale());
    await p.waitForTimeout(4500); const s1 = await p.evaluate(() => window.__subs);
    ok(a && bFlag && cFlag && dFlag && s1 === s0 + 1, '9 live data: saved copy ignored=' + a + ', stale flagged after 12s=' + bFlag + ', cleared on confirmed data=' + cFlag + ', no flash on a dropped subscription=' + dFlag + ', resubscribed=' + (s1 === s0 + 1));
  }

  // 10. sync warning: banner only after a full minute without confirmed data; nothing during quiet time after a confirmed load
  {
    await ctx.close();
    const cfresh = async () => {
      const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(init); const q = await c.newPage();
      q.on('pageerror', e => { console.log('PAGEERROR', e.message); fails++; });
      await q.clock.install({ time: new Date('2026-01-01T10:00:00Z') }); await q.goto('file://' + page); await q.clock.runFor(1500); return [c, q];
    };
    const shown = (q) => q.evaluate(() => { const a = document.getElementById('sync-alert'); return !!a && !a.hidden && a.getAttribute('role') === 'alert'; });
    let [c1, q1] = await cfresh();
    await q1.clock.runFor(30000); const at30 = await shown(q1); await q1.clock.runFor(32000); const at62 = await shown(q1);
    await fire(q1, 'items', {}, false); await fire(q1, 'releases', {}, false); await q1.clock.runFor(2500); const cleared = !(await shown(q1));
    await c1.close();
    let [c2, q2] = await cfresh(); await fire(q2, 'items', {}, false); await fire(q2, 'releases', {}, false);
    let quiet = true; for (let i = 0; i < 10; i++) { await q2.clock.runFor(60000); if (await shown(q2)) quiet = false; }
    await c2.close();
    ok(!at30 && at62 && cleared && quiet, '10 sync warning: none at 30s=' + !at30 + ', banner after a minute=' + at62 + ', hides on confirmed data=' + cleared + ', quiet 10 minutes=' + quiet);
    [ctx, p] = await fresh();
  }

  await ctx.close(); await b.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
