/**
 * "ספר המתכונים שלי" - one page per adventure that gathers the recipes of
 * the stations the child already finished, so they can be reopened without
 * replaying the games (user feedback, Oct 2026).
 *
 * The recipes are not copied here. Each entry points at where the game
 * already shows it:
 *   img:  a full-page recipe image (italy, protein, stem)
 *   from: a game page whose #recipe-sheet modal holds the recipe (dinner);
 *         the sheet is fetched and its contents shown as-is.
 *
 * Usage from <adventure>/recipes.html:
 *   renderRecipeBook({ back: 'index.html', items: [
 *     { name: 'רובוט טורטייה', emoji: '🤖', done: true, from: 'game3.html' }, ...
 *   ]});
 */
(function () {
  'use strict';

  var CSS = [
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}',
    'html,body{background:#1A3D1F;min-height:100%}',
    "body{font-family:'Rubik',sans-serif;direction:rtl;color:#F5F0DC;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 32px);-webkit-user-select:none;user-select:none}",
    '.rb-page{max-width:480px;margin:0 auto}',
    '.rb-top{display:flex;justify-content:flex-start;margin-bottom:14px}',
    '.rb-back{background:rgba(0,0,0,.28);color:#fff;border:none;border-radius:20px;padding:8px 16px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}',
    "h1{font-family:'Fredoka One',cursive;font-size:30px;text-align:center;color:#F5C842;margin-bottom:6px}",
    '.rb-sub{text-align:center;font-size:15px;color:rgba(245,240,220,.7);margin-bottom:20px}',
    '.rb-list{display:flex;flex-direction:column;gap:12px}',
    '.rb-item{display:flex;align-items:center;gap:14px;width:100%;text-align:right;font-family:inherit;border:none;border-radius:20px;padding:16px 18px;cursor:pointer;background:#F5F0DC;color:#1A3D1F;box-shadow:0 6px 20px rgba(0,0,0,.25)}',
    '.rb-item:active{transform:scale(.98)}',
    '.rb-emoji{font-size:34px;line-height:1}',
    '.rb-name{flex:1;font-size:19px;font-weight:700}',
    '.rb-chip{font-size:13px;font-weight:700;background:#F5921E;color:#fff;border-radius:12px;padding:5px 10px;white-space:nowrap}',
    '.rb-item.locked{background:rgba(245,240,220,.07);color:rgba(245,240,220,.4);box-shadow:none;cursor:default}',
    '.rb-item.locked .rb-emoji{filter:grayscale(1);opacity:.4}',
    '.rb-item.locked .rb-chip{background:rgba(245,240,220,.1);color:rgba(245,240,220,.45)}',
    '.rb-empty{text-align:center;font-size:15px;color:rgba(245,240,220,.6);margin-top:18px;line-height:1.6}',
    /* Recipe viewer */
    '#rb-view{display:none;position:fixed;inset:0;z-index:50;background:#fff;flex-direction:column}',
    '#rb-view.open{display:flex}',
    '#rb-view-hdr{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;background:#1A3D1F;color:#F5F0DC}',
    "#rb-view-title{flex:1;font-family:'Fredoka One',cursive;font-size:20px}",
    '#rb-view-close{background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:16px;padding:8px 14px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}',
    '#rb-view-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#2C3E50;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 24px);-webkit-user-select:text;user-select:text}',
    '#rb-view-body img{max-width:100%;display:block}',
    '#rb-view-body > img.rb-full{width:100%}',
    '.rb-loading{text-align:center;padding:40px 20px;font-size:16px;color:#7F8C8D}',
    /* Styles of the dinner recipe sheets, merged from the game pages */
    '.sheet-img{width:100%;display:block}',
    '.sheet-body,.s-body{padding:16px 18px 0}',
    ".sheet-title,.s-title{font-family:'Fredoka One',cursive;font-size:22px;color:#2C3E50;margin-bottom:14px}",
    '.ingr-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}',
    '.ingr-item{background:#FFF8EE;border:1.5px solid #F0D8A0;border-radius:12px;padding:8px 10px;font-size:13px;font-weight:700;color:#4A3000;display:flex;align-items:center;gap:6px}',
    '.steps-list{display:flex;flex-direction:column;gap:10px}',
    '.step-row{display:flex;gap:10px;align-items:flex-start}',
    '.step-num{min-width:26px;height:26px;border-radius:50%;background:#4CAF50;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0}',
    '.step-txt{font-size:14px;font-weight:700;color:#2C3E50;line-height:1.5;padding-top:3px}',
    '.tip-box{background:#EDE7F6;border-radius:12px;padding:10px 12px;margin-top:12px;font-size:13px;font-weight:700;color:#4A148C;line-height:1.6}',
    '@media (min-width:768px){.rb-page{max-width:640px}h1{font-size:40px}.rb-name{font-size:24px}#rb-view-body{max-width:640px;margin:0 auto;width:100%}}'
  ].join('\n');

  var sheetCache = {};

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Pull the recipe out of a game page's modal. The game pages are local
  // files served by the app itself, so their markup is trusted.
  function loadSheet(url) {
    if (sheetCache[url]) return sheetCache[url];
    sheetCache[url] = fetch(url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var sheet = doc.getElementById('recipe-sheet');
        if (!sheet) throw new Error('no recipe in ' + url);
        sheet.querySelectorAll('.sheet-handle,.s-handle,.sheet-close,.s-close,button')
          .forEach(function (n) { n.remove(); });
        return sheet.innerHTML;
      });
    sheetCache[url].catch(function () { delete sheetCache[url]; });
    return sheetCache[url];
  }

  function openRecipe(item) {
    var view = document.getElementById('rb-view');
    var body = document.getElementById('rb-view-body');
    document.getElementById('rb-view-title').textContent = item.emoji + ' ' + item.name;
    body.innerHTML = '';
    body.scrollTop = 0;
    view.classList.add('open');

    if (item.img) {
      var img = el('img', 'rb-full');
      img.src = item.img;
      img.alt = 'מתכון ' + item.name;
      body.appendChild(img);
      return;
    }
    body.appendChild(el('div', 'rb-loading', 'פותחים את המתכון…'));
    loadSheet(item.from).then(function (html) {
      body.innerHTML = html;
    }).catch(function () {
      body.innerHTML = '';
      body.appendChild(el('div', 'rb-loading', 'לא הצלחנו לפתוח את המתכון. נסו שוב.'));
    });
  }

  function closeRecipe() {
    document.getElementById('rb-view').classList.remove('open');
  }

  window.renderRecipeBook = function (opts) {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var page = el('div', 'rb-page');
    var top = el('div', 'rb-top');
    var back = el('button', 'rb-back', '→ חזרה');
    back.onclick = function () { window.location.href = opts.back || 'index.html'; };
    top.appendChild(back);
    page.appendChild(top);

    page.appendChild(el('h1', null, '📖 ספר המתכונים שלי'));
    var doneCount = opts.items.filter(function (it) { return it.done; }).length;
    page.appendChild(el('p', 'rb-sub', doneCount
      ? 'כל המתכונים שפתחתם בהרפתקה. לחצו על מתכון כדי להכין אותו שוב!'
      : 'כאן יופיעו המתכונים שתפתחו בהרפתקה.'));

    var list = el('div', 'rb-list');
    opts.items.forEach(function (item) {
      var b = el('button', 'rb-item' + (item.done ? '' : ' locked'));
      b.appendChild(el('span', 'rb-emoji', item.emoji));
      b.appendChild(el('span', 'rb-name', item.name));
      b.appendChild(el('span', 'rb-chip', item.done ? '📋 למתכון' : '🔒 עוד לא נפתח'));
      if (item.done) b.onclick = function () { openRecipe(item); };
      else b.disabled = true;
      list.appendChild(b);
    });
    page.appendChild(list);

    if (!doneCount) {
      page.appendChild(el('p', 'rb-empty', 'סיימו את התחנה הראשונה, והמתכון שלה יחכה לכם כאן 👨‍🍳'));
    }

    var view = el('div');
    view.id = 'rb-view';
    var hdr = el('div');
    hdr.id = 'rb-view-hdr';
    var title = el('div');
    title.id = 'rb-view-title';
    var close = el('button', null, '✕ סגירה');
    close.id = 'rb-view-close';
    close.onclick = closeRecipe;
    hdr.appendChild(title);
    hdr.appendChild(close);
    var vbody = el('div');
    vbody.id = 'rb-view-body';
    view.appendChild(hdr);
    view.appendChild(vbody);

    document.body.appendChild(page);
    document.body.appendChild(view);
  };
})();
