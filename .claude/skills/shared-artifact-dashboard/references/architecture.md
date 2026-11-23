# Architecture of a shared Artifact board

Contents: 1. Files and build - 2. Collections and fields - 3. Load order - 4. Merge, local copy, tombstones - 5. Writes and the log - 6. Numbering - 7. Self-republish and its guards - 8. Views and filters - 9. Multi-project - 10. Identity - 11. Optional Google Docs mirror

All snippets are from `assets/board-template.html` (ES5 style, no build step, so the page can rebuild itself from its own DOM).

## 1. Files and build

- `board.tpl.html`: the page with the literal `__SEED__` inside `<script type="application/json" id="seed">__SEED__</script>`, and the app code in `<script id="app">`.
- `build_seed.py` replaces `__SEED__` with `{"items":[...],"releases":[...],"log":[...],"projects":[...],"at":"dd/mm HH:MM"}` read from a dump folder (`<dump>/<collection>/<id>.json`, exactly what `ArtifactData list ... out_dir` writes). It escapes `</` so the JSON cannot close the script tag.
- At load, the app captures `PARTS`: the outerHTML of the top-level body nodes (title, meta, link, style, the page markup, the seed script). Capture happens before any JS changes the DOM, so a republish reproduces the template, not the current screen state.

## 2. Collections and fields

- `items`: `{project, num, type, status, sev, owner, pkg, source, release, title, desc, labels[], due, files[], archived, answer, note, screen, device, reporters, by, createdBy, createdAt, updatedAt}`.
- `releases`: `{project, name, status: planned|active|released|archived, prevStatus, order, targetDate, releasedAt, build, notes, createdAt, updatedAt}`. The doc id equals the name for the first project (legacy) and `<projectId>~<name>` for others, so "1.0" can exist in two projects.
- `log`: `{project, at, who, by, col, itemId, key, title, action, details}`. Written for every change; the log tab and the "who" filter read it.
- `projects`: `{name, symbol, icon (data URL, 96px), createdAt, updatedAt, by}`; doc id = lower-case symbol. The default project is defined in code (`PROJ0`) and a `projects/gc` doc, if present, overrides its name/icon.
- Constants maps drive labels and dropdown options: `TYPE`, `SEV`, `ST` (item status), `RST` (release status), `PKG`, `SRC`, `OWN`, `ME`. Changing a label = change the map.

## 3. Load order

1. Render from the seed immediately (`seedShown=true; refresh()`).
2. `db = await window.claude.use('db')`; if null, stay read-only on the seed and say so in the sync line (logo tooltip).
3. For each collection: `get()` with a 15 s timeout, then `onSnapshot()`. Each snapshot sets `live[col]` and calls `refresh()`. Ignore an empty snapshot that comes from cache when the seed has data (it would blank the board for a moment).
4. `use('artifact')`: if the local copy holds changes the seed lacks (`localAhead()`), schedule one republish, rate-limited (see 7).

## 3b. Freshness (confirmed vs saved data)

- `liveFresh[col]` is true only after a snapshot with `metadata.fromCache` false. Until then `baseOf(col)` merges the saved copy and the seed per document, newer `updatedAt` wins; local copies and tombstones are cleared only against confirmed data; a saved copy never replaces confirmed data.
- `updateSyncState()` sets the sync text (logo tooltip) and removes the stale ring; `showStale(why)` adds the gold ring and a one-time toast. A 12 s timer after subscribing calls it if items and releases are not confirmed; a terminal subscription error calls it at once.
- `sub(col,n)` subscribes and, on a terminal `unavailable` (or unknown) error, resubscribes after 3 s x 2^n (max 5 min) plus jitter. Never subscribe from render code.

## 4. Merge, local copy, tombstones

```js
function merged(col){
  var map={},base=live[col]||SEED[col]||[],all=lsGet(),dead=all.deleted||{};
  base.forEach(function(d){map[d.id]=Object.assign({},d)});
  var l=all[col]||{},changed=false;
  Object.keys(l).forEach(function(id){var mine=l[id],cur=map[id];
    var cu=cur?String(cur.updatedAt||cur.at||''):'',mu=String(mine.updatedAt||mine.at||''),mb=String(mine._base||'');
    if(live[col]&&cur&&(cu===mu||(cu!==mb&&cu>=mu))){delete l[id];changed=true;return}   // server caught up or someone newer won
    if(!cur||cu===mb||mu>cu){var o=Object.assign({},cur||{},mine);delete o._base;map[id]=o}});
  // item tombstones: drop once live confirms the doc is gone
  // release tombstones expire when a doc with a NEWER createdAt appears (re-created version)
  ...
}
```

Why the release tombstone expiry matters: a user deleted version 1.3 and created it again. The old tombstone hid the new doc, `localAhead()` stayed true forever, and every open tab republished in a loop (version 31 to 274 in an afternoon). Rule: a tombstone may only hide a doc created before the tombstone; clear the tombstone explicitly when you create a doc with that id.

## 5. Writes and the log

- `patch(col,id,data,action)`: sets `updatedAt`, `remember()`s the optimistic copy with `_base = cur.updatedAt`, writes a log entry with a human diff (`describe(before,data)` via `FIELD` labels), `refresh()`, `schedulePublish()`, then `db.collection(col).doc(id).update(data)`. On failure: a visible toast, never silent.
- Creating: `retry(fn,3)` with backoff (700 ms x attempt) around `add()`/`set()`. Disable the create button while saving (double clicks made duplicates).
- Multi-step operations (create version with 9 template tasks) count successes and report partial failure: "created version X, but only 7 of 9 tasks were saved".
- Deleting: tombstone first, refresh, then delete in the DB; on failure toast the error.
- `logEvent()` writes in the background with retry; it must never block the UI.

## 6. Numbering (task keys like GC-17)

Never reuse a number, even after deletes, because log entries and conversations refer to keys.

```js
var maxNum=numFloors[curProj]||0, loc=lsGet().items||{}, rx=new RegExp('^'+symbol+'-(\\d+)');
items.forEach(x=>maxNum=Math.max(maxNum,x.num||0));                 // current project's items
Object.keys(loc).forEach(k=>{ if(projOf(loc[k])===curProj) maxNum=Math.max(maxNum,loc[k].num||0) });
logs.forEach(e=>{ var m=rx.exec(e.key||''); if(m) maxNum=Math.max(maxNum,+m[1]) });  // deleted items live on in the log
numFloors[curProj]=maxNum+1;  doc.num=maxNum+1;
```

`keyOf(i) = symbolOf(project(i)) + '-' + num`. Items without `num` get a temporary display number `_n` (never saved).

## 7. Self-republish and its guards

```js
function buildDoc(){ var data={items:allItems.map(strip),releases:allReleases.map(strip),
    log:allLogs.sort(byAt).slice(-600).map(strip),projects:projects.map(strip),at:stamp};
  buildDoc.sig=sigOf(data); ... return wrapper+PARTS-with-new-seed }
async function doPublish(){
  if(anyEditing()) return retryLater();                      // never republish while someone types
  var doc=buildDoc(); if(SEED_SIG && buildDoc.sig===SEED_SIG) return; // no-op: data equals the page copy
  try{ await artifactApi.publish(doc); SEED_SIG=buildDoc.sig }
  catch(e){ if(e.code==='conflict') reload-notice; if(not_writer) read-only notice }
}
```

- `sigOf()` is a canonical, key-sorted JSON (`canon()`), ignoring view-only fields (`_n`, `_base`). Compare signatures over ALL data. When the board gained projects, building the copy from the filtered `items` would have made every project switch look like a change and trigger a republish.
- On load with `localAhead()`, republish at most once per 2 minutes (`localStorage gc_autopub` timestamp).
- `schedulePublish()` debounces 4 s; a conflict means another tab won, so reload instead of overwriting.
- Republishing is visible to you as "Publish refused - newer version saved from inside the page" when you publish next. That is normal; see the publish protocol.

## 8. Views and filters

- State: `curProj, selRel, view ('board'|'list'), filter (status group), special, typeFilter, xf={own,sev,pkg,src}, sortBy, query`.
- `inFilter(i)` applies, in order: sticky (an item just edited stays visible until the view changes), query or release, type, extra filters, archive, waiting requests, status group.
- Defaults depend on the view: columns view shows "all" statuses (columns are the status), list view shows "open".
- Board view: CSS columns per status that fill the frame height; each column scrolls internally. Drag between columns with Sortable (handle on the card title row) writes the status and a log entry.

## 9. Multi-project

```js
function projOf(x){return (x&&x.project)||'gc'}
function refresh(){ allItems=merged('items')...; allReleases=...; allLogs=...; projects=merged('projects');
  if(!projList().some(p=>p.id===curProj) && (live.projects||noDb)){curProj='gc';selRel=''}   // reset only when we really know
  var inP=x=>projOf(x)===curProj; items=allItems.filter(inP); releases=allReleases.filter(inP); logs=allLogs.filter(inP);
  ... renderAll() }
```

- New docs get `project: curProj`; log entries get the doc's project.
- The selected project is remembered in `localStorage`; switching resets version selection, filters and search.
- Title, logo/icon, agent instructions, export headings and file names come from the project. A project without an image gets a generated SVG icon with its symbol (`genIcon`). Uploaded icons are resized to 96 px PNG in a canvas before saving (keeps docs small).
- The symbol is fixed after creation (it is part of every key). Name and icon are editable.
- Not per project unless asked: team members, the version task template, external mirrors.

## 10. Identity

- `use('user')`: `id()`, `isOwner()`. Map known ids to names (`idName(id)`) so the log shows real names instead of "unknown"; detect the owner automatically and store the choice locally. Keep a manual override in a technical tab, not in the main toolbar (users read a toolbar dropdown as a filter and think it is broken).
- Profiles lookup for display names may be unavailable; do not depend on it.

## 11. Optional Google Docs mirror

The page can mirror the export to a Google Doc through the `mcp` capability (`read_doc` for the end index, `update_doc` with delete + insert + RTL paragraph style). Debounce 6 s, run only for the project it belongs to, and record a signature so unchanged data is not re-sent.
