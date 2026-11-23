// Measure rows and spacing of a built board at several widths, and optionally take screenshots.
//   node measure_layout.js <built.html> [--row "top=.ovr-top h1|#vline|#relpanel .verbar|#projpick|#topacts"]
//        [--row "filters=#fbar>.glbl|#fbar .fdd"] [--clip "#relpanel .verbar"] [--widths 1280,1440,1600,1920]
//        [--shots out/prefix] [--dark]
// For each width and row prints: lines (distinct vertical centres), gaps between neighbours in visual order (px),
// plus page overflow, clipped elements (scrollWidth > clientWidth) and squeezed <select>s. Phone (390) always checked.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { wrap, init } = require(path.join(__dirname, 'mock_runtime.js'));
const args = process.argv.slice(2);
const built = args[0];
const opt = (k, d) => { const out = []; args.forEach((a, i) => { if (a === k) out.push(args[i + 1]); }); return out.length ? out : d; };
const rows = opt('--row', ['top=.ovr-top h1|#vline|#relpanel .verbar|#projpick|#topacts', 'filters=#fbar>.glbl|#fbar .fdd']).map(r => { const [n, s] = r.split('='); return { n, sels: s.split('|') }; });
const clip = opt('--clip', ['#relpanel .verbar']);
const widths = opt('--widths', ['1280,1440,1600,1920'])[0].split(',').map(Number);
const shots = opt('--shots', [null])[0];
const dark = args.includes('--dark');
const page = path.resolve(path.dirname(built), 'measure.html');
fs.writeFileSync(page, wrap(fs.readFileSync(built, 'utf8')));

(async () => {
  const b = await chromium.launch();
  const run = async (w, scheme) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    await ctx.addInitScript(init); const p = await ctx.newPage();
    await p.goto('file://' + page); await p.waitForTimeout(800);
    if (w < 961) { const t = await p.$('#tab-tasks'); if (t) await t.click(); await p.waitForTimeout(150); }
    const r = await p.evaluate(({ rows, clip }) => {
      const out = {};
      rows.forEach(({ n, sels }) => {
        const els = sels.flatMap(s => [...document.querySelectorAll(s)]).filter(e => e.offsetWidth || e.offsetHeight);
        const rs = els.map(e => e.getBoundingClientRect()).sort((a, b) => b.right - a.right); // visual order, RTL first
        const cy = x => Math.round((x.top + x.bottom) / 2), lines = [...new Set(rs.map(cy))];
        out[n] = { lines: lines.length,
          gaps: lines.length > 1 ? lines.map(l => { const r = rs.filter(x => Math.abs(cy(x) - l) < 4); return r.slice(1).map((x, i) => Math.round(r[i].left - x.right)); })
                                 : rs.slice(1).map((x, i) => Math.round(rs[i].left - x.right)) };
      });
      out.overflow = document.documentElement.scrollWidth > innerWidth;
      out.clipped = clip.filter(s => { const e = document.querySelector(s); return e && e.scrollWidth > e.clientWidth + 1; });
      out.squeezed = [...document.querySelectorAll('select')].filter(s => s.offsetWidth && s.scrollWidth > s.clientWidth + 1).map(s => s.id || s.name);
      return out;
    }, { rows, clip });
    if (shots) { fs.mkdirSync(path.dirname(shots), { recursive: true }); await p.screenshot({ path: `${shots}-${w}-${scheme}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(900, 260) } }); }
    console.log(w, scheme, JSON.stringify(r));
    await ctx.close();
  };
  for (const w of widths) { await run(w, 'light'); if (dark) await run(w, 'dark'); }
  await run(390, 'light');
  await b.close();
})();
