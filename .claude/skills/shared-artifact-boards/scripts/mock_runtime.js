// Shared by test_harness.js and measure_layout.js.
// wrap(): wraps a built page the way the platform serves it (doctype, viewport, minimal reset).
// init(): injected before any page script; mocks window.claude so the page runs offline.
//   db.collection(c).get()        never resolves (the page keeps showing its seed)
//   onSnapshot(fn)                stored in window.__snap[c] (use fire() to deliver a snapshot)
//   add / doc(id).update/set/delete  recorded in window.__w as ['add',c,title] ['update',c,id,json] ['set',c,id] ['del',c,id]
//   window.__failTitle = 'x'      makes add() throw for that title (partial-failure tests)
//   artifact.publish(html)        recorded in window.__pub (length of html)
const wrap = h => '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>:root{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style></head><body>' + h + '</body></html>';
const init = () => {
  window.__w = []; window.__pub = []; window.__snap = {}; let n = 0;
  const db = { collection: (c) => ({
    get: () => new Promise(() => {}),
    onSnapshot: (fn) => { window.__snap[c] = fn; return () => {}; },
    add: async (o) => { if (window.__failTitle && o.title === window.__failTitle) throw new Error('mock write failure'); __w.push(['add', c, o.title]); return { id: 'n' + (++n) }; },
    doc: (id) => ({
      update: async (o) => { __w.push(['update', c, id, JSON.stringify(o)]); },
      delete: async () => { __w.push(['del', c, id]); },
      set: async (o) => { __w.push(['set', c, id, JSON.stringify(o)]); },
    }),
  }) };
  window.claude = { use: async (k) =>
    k === 'db' ? db :
    k === 'artifact' ? { publish: async (h) => { __pub.push(h.length); } } :
    k === 'permissions' ? { state: async () => 'granted' } :
    k === 'user' ? { id: async () => 'u_test', isOwner: async () => true, can: async () => true } : null };
};
// fire(page, col): deliver the seed's copy of a collection as a live snapshot (simulates another user's update).
const fire = (p, col) => p.evaluate((col) => {
  const seed = JSON.parse(document.getElementById('seed').textContent);
  const docs = (seed[col] || []).map(d => ({ id: d.id, data: () => d }));
  window.__snap[col] && window.__snap[col]({ docs, metadata: {} });
}, col);
module.exports = { wrap, init, fire };
