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

  await ctx.close(); await b.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
