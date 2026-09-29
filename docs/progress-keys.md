# Progress & entitlement keys — dinner/ and italy/ packages

Audit of every `localStorage`/`sessionStorage` key touched by the `www/dinner/`
and `www/italy/` game packages, who writes it, and who reads it. Compiled by
grepping every `localStorage.(get|set|removeItem)` call under `www/` and
tracing each key by hand — not derived from a spec, so treat this as the
actual current behavior, warts included.

Scope: `www/dinner/`, `www/italy/`, and the shared app-shell/certificate code
that touches their keys (`www/app/packages.html`, `www/assets/certificate-share.js`,
`www/assets/final-screen.js`). `www/free/` runs its own, unrelated key set
(`userName`, `story2_completed`, …) and isn't covered here.

## italy/

| Key | Type | Written by | Read by |
|---|---|---|---|
| `italy_unlocked` | `'true'` flag (purchase entitlement) | `app/packages.html` (on successful RC purchase or restore, 3 call sites); `italy/access-guard.js` `setCachedUnlocked` (after a cold-cache RC verify on native) | `italy/access-guard.js` (gate on every italy page load); `app/packages.html` (button state, 2 call sites) |
| `italy_access_rechecked` | sessionStorage flag | `italy/access-guard.js` | `italy/access-guard.js` (same file — ensures the background RC recheck runs at most once per session) |
| `italy_stars_detail` | JSON array, 4 slots, one per **recipe** (not per game) | `italy/game1.html`…`game8.html` — only the *second* game of each recipe pair writes a slot: `game2→[0]`, `game4→[1]`, `game6→[2]`, `game8→[3]` (`game1/3/5/7` also write to this key defensively but their writes are effectively no-ops/overwritten — see Findings) | `italy/unlock-logic.js` (`isUnlocked`, `isDone`, `getTotalStars`, `getDoneCount` — powers `index.html`'s recipe hub); `italy/final_screen.html` (renders per-recipe stars; also the only place that `removeItem`s this key, on replay/reset) |
| `italy_stars` | flat sum of the above | written alongside `italy_stars_detail` by every italy game (1–8) | **nobody** — no `getItem('italy_stars')` anywhere in `www/`. `final_screen.html` does `removeItem` it on reset, but never reads it. Dead key. |
| `chefName` | string | `app/onboarding.html` | `italy/completion.html`, `italy/final_screen.html`, `italy/index.html` (×2), `app/packages.html`, `assets/certificate-share.js` — shared across both packages, not italy-specific |
| `childPhoto` | data URL | `italy/completion.html` | `assets/certificate-share.js` — shared across both packages |

## dinner/

| Key | Type | Written by | Read by |
|---|---|---|---|
| `dinner_stars_detail` | JSON array, 11 slots, one per **game**, index = `gameNumber - 1` | every `dinner/game1.html`…`game11.html` | `dinner/index.html` (`isUnlocked`, `isNewlyUnlocked`, `getTotalStars`); `assets/final-screen.js` (debug skip/replay tool, dinner-only) |
| `dinner_stars` | flat sum | written alongside `dinner_stars_detail` by every dinner game | **nobody**. Same dead-key pattern as `italy_stars`. |
| `game1_completed` … `game4_completed` | `'1'` flag | `dinner/game1.html`, `game2.html`, `game3.html`, `game4.html` (only these 4 of the 11 games write this pattern) | **nobody**. Dead keys — see Findings. |
| `station1_completed` … `station5_completed` | `'1'` flag, canonical station-complete marker | `dinner/game3.html` (hardcodes `station1_completed` directly, since it's the last game of station 1 and predates `station-flow.js`'s managed range); `dinner/station-flow.js` (writes `station{N}_completed` for stations 2–5, driven by its own `ROUTING` table over games 4–11) | `dinner/index.html` (`isCompleted`, gates station unlock); `assets/final-screen.js` |
| `recipe1_completed` … `recipe5_completed` | `'1'` flag, **legacy alias** of the `station*_completed` keys above, written in lockstep with them by the same two writers | same as `station*_completed` | `dinner/index.html` (`isCompleted` — OR'd with the `station*` key at the same index); `assets/final-screen.js` (same OR pattern) |
| `adventure_completed_seen` | `'1'` flag | `dinner/index.html` | `dinner/index.html` (same file — one-shot redirect to `completion.html` the first time all 4 stations are done) |
| `chefName` | string | `app/onboarding.html` | `dinner/completion.html`, `dinner/final_screen.html`, `dinner/index.html`, `assets/certificate-share.js` |
| `childPhoto` | data URL | `dinner/completion.html` | `assets/certificate-share.js` |

No `dinner_unlocked` / entitlement key exists — confirmed dinner has no
`access-guard.js` equivalent and `app/packages.html` links straight to
`dinner/index.html` with no purchase check. Dinner is free; italy is gated.

## Findings (current split, not yet acted on)

1. **Two different indexing schemes share the same key shape.** `dinner_stars_detail[i]` is indexed by absolute game number (`gameNumber - 1`, 11 slots). `italy_stars_detail[i]` is indexed by recipe pair (`gameNumber / 2 - 1`, 4 slots). Same naming convention, incompatible semantics — a shared engine cannot derive the index from a single "position" number without being told which scheme applies.
2. **`italy_stars` and `dinner_stars` are dead.** Written on every single game completion, read nowhere. Every consumer (`unlock-logic.js`, `dinner/index.html`) recomputes the sum from `*_stars_detail` itself instead.
3. **`game1_completed`…`game4_completed` are dead.** Written by dinner games 1–4, read nowhere — superseded by `station*_completed`/`recipe*_completed`, which is what `index.html` actually checks.
4. **Two writers for the same station flag, by accident of history.** `dinner/game3.html` hardcodes `station1_completed`/`recipe1_completed` inline (predates `station-flow.js`); games 4–11 get the identical pair written by `station-flow.js`'s shared routing table. Two different code paths produce the same contract, which is the "double-sourcing" the next package should avoid outright.
5. **`recipe*_completed` is a straight legacy duplicate of `station*_completed`**, written together and always read together via OR. It's not read by anything that doesn't also check the `station*` key — looks safe to drop if a hard cutover is ever done, but out of scope here since dinner/ isn't being touched.
6. **italy's non-assemble games (1/3/5/7) also touch `italy_stars_detail`.** They read-modify-write the same array their paired assemble game (2/4/6/8) owns the slot for. Worth confirming exactly what they write before assuming they're harmless no-ops — not verified line-by-line here.

No changes were made to `dinner/` or `italy/` — this is a read-only audit.

## Contract for package 3 (new — not a refactor of the above)

The current split exists because dinner predates `station-flow.js` for its
first station, and because italy's purchase gate (`access-guard.js`) grew
independently of dinner's free/no-gate model. Package 3 should not inherit
either accident:

- **One writer, one reader, one key set, per page.** The assemble-engine
  instance on a game page writes exactly the keys package 3's own
  `access-guard`/hub-unlock script reads — nothing else touches them. No
  `station-flow.js`-style shared router that *also* writes completion keys
  out from under the game page.
- **No dual canonical/legacy key pairs.** One name per fact. If package 3
  ever needs a rename, migrate the reader, don't grow a second key that's
  OR'd forever.
- **No dead keys.** Every key the engine writes must have a real reader in
  the guard/hub script, decided at config time — don't write a `*_stars`
  flat-sum convenience value unless something actually consumes it.
- **Index scheme is explicit config, not derived.** Per the earlier
  `stationIndex - 1` bug: the engine must take an explicit `starsIndex` (or
  equivalent) from the page config rather than computing it from a station
  or game number, since those two numbers are not interchangeable even
  within a single package (see Finding 1).

Package 3 is **protein** ("השף הירוק חוקר חלבונים") and is paid, so it
mirrors italy's guard model (RevenueCat entitlement check, redirect-until-
verified) — not dinner's (no guard at all, free). Identifiers:

| | |
|---|---|
| Entitlement | `protein` |
| Product ID | `com.michalskurnik.hashefhayarok.protein` |
| Storage key prefix | `protein` |

Concretely, for a protein game page:

```js
createAssembleGame({
  steps: [...],
  storageKeyPrefix: 'protein',
  starsIndex: 2,                 // explicit slot in protein_stars_detail
  completionFlags: [],           // protein's guard/hub reads *_stars_detail directly;
                                  // no separate completion-flag key needed unless
                                  // the guard is designed to require one
});
```

and the protein hub script (once `protein/index.html` exists) reads
`protein_stars_detail` directly, following `italy/unlock-logic.js`'s pattern
(one array, one owner per slot, one reader) — not `dinner/index.html`'s
OR-two-keys pattern.

### Guard scaffolding (built now, ahead of game content)

Italy hardcodes its entitlement name and product id in **two** places —
`italy/access-guard.js` (`ITALY_ENTITLEMENT = 'italy'`) and
`app/packages.html` (`ITALY_ENTITLEMENT` / `ITALY_PRODUCT_ID`, redefined
there, kept in sync by hand). Protein must not repeat that:

- **`www/assets/protein-config.js`** — the one place the entitlement name,
  product id, and storage key prefix are defined (`PROTEIN_CONFIG` object,
  dual Node/browser export like `unlock-logic.js`). Any purchase flow added
  to `app/packages.html` later must `require`/`<script src>` this file
  instead of retyping the strings.
- **`www/protein/access-guard.js`** — same decision logic and lifecycle as
  `italy/access-guard.js` (pure `decideInitialAccess` / `decideAfterVerify` /
  `shouldRunBackgroundRecheck` / `decideBackgroundRecheckOutcome`, unit-
  testable via `module.exports`), but reads `ENTITLEMENT` from
  `PROTEIN_CONFIG` and derives `protein_unlocked` / `protein_access_rechecked`
  from `PROTEIN_CONFIG.STORAGE_KEY_PREFIX` rather than hardcoding them.

The pure decision-logic functions themselves are still duplicated between
`italy/access-guard.js` and `protein/access-guard.js` (identical bodies,
copied rather than shared) — factoring those into one core module would mean
editing `italy/access-guard.js`, which is out of scope while italy/ is
frozen pending App Store approval. Worth revisiting once italy/ is
unfrozen.

No `protein/unlock-logic.js` (hub-unlock reader) or `protein/index.html`
exist yet — there's no recipe list or game content to hang them on. Write
that reader when the hub page is built, following `italy/unlock-logic.js`'s
shape: read `protein_stars_detail` directly, no legacy-key OR, no flat-sum
`protein_stars` key unless something is actually going to read it.

### Deferred cleanup

The dead keys found in the audit above (`italy_stars`, `dinner_stars`,
`game1_completed`…`game4_completed`) are confirmed unread but **not removed**
— cleanup is deferred until after App Store approval, per instruction, since
dinner/ and italy/ are frozen until then.

## Contract for package 4 (stem — "ניסויים במטבח") — mirrors package 3

Package 4 is **stem** and is paid, same guard model as italy/protein
(RevenueCat entitlement check, redirect-until-verified). Identifiers:

| | |
|---|---|
| Entitlement | `stem` |
| Product ID | `com.michalskurnik.hashefhayarok.stem` (proposal — confirm before wiring a real purchase flow; note it follows protein's bundle scheme, `com.michalskurnik.hashefhayarok.*`, which differs from italy's older `com.michalskurnik.chefapp.italy` — worth reconciling before store submission) |
| Storage key prefix | `stem` |

Built so far: `www/assets/stem-config.js` (config, same Node/browser
dual-export shape as `protein-config.js`), `www/stem/access-guard.js`
(copied from `protein/access-guard.js`, reads `STEM_CONFIG` instead of
hardcoding strings), `www/stem/unlock-logic.js` (station model below, plus
a `STATIONS` metadata array the same way `italy/unlock-logic.js` keeps its
`RECIPES` array), `www/stem/index.html` (the hub — "האב", see below).
`game1.html`–`game10.html`, `final_screen.html`, `completion.html` don't
exist yet — each is its own Asana task; no empty placeholder files were
created for them, matching how `protein/` only has real files for the games
actually built, not a full stub skeleton.

Station names/order/keys/layout are per the package spec ("אפיון חבילת
ניסויים במטבח", linked from the Asana project's own description) —
not guessed.

**`chefName` / `childPhoto` are reused as-is** — decided against adding a
separate `stem_child_name` key, to avoid the exact "dual key for the same
fact" pattern this doc's findings warn about. `app/onboarding.html` stays
the one writer; stem pages read `chefName`/`childPhoto` the same way
italy/protein do. (The spec's own key table lists `stem_child_name` too, but
annotates it "קיים, משותף" — existing, shared — confirming the intent was
always to reuse the shared key, not add a new one.)

**Station model** (per spec, confirmed with Michal): 5 stations — 4 regular
experiment stations (לחמניות שמרים, ריבת תותים, כרוב סגול, גלידה בשקית) +
one locked "extra" (הר געש / volcano), unlocked only once the 4 regular
stations are all done. Each station owns exactly 2 games (lab + sorting),
so games are numbered 1..10 sequentially: station `s` (1-indexed here,
0-indexed as `STATIONS[i]` in code) owns games `(2s-1)` and `(2s)`.
Stations 1–4 unlock **sequentially**, same rule as `italy/unlock-logic.js`
(station 1 always open, station `s` opens once station `s-1` is done) — not
all-open-from-the-start. **The certificate (completion.html) is earned from
the 4 regular stations alone** — the extra/volcano station does not count
toward it (per spec) — so `unlock-logic.js` exposes this as its own
`mainStationsDone()`, separate from `isAllComplete()` (all 5, including the
volcano — the "5th gold sticker" state on `final_screen.html`).

| Key | Type | Written by | Read by |
|---|---|---|---|
| `stem_game{n}_completed` (n=1..10) | `'1'` flag | `stem/game{n}.html` itself — one writer per key, no shared router | `stem/unlock-logic.js` (`isStationDone`, `isStationUnlocked`, `mainStationsDone`, `getDoneCount`); `index.html` (per-game checkmarks) |
| `stem_station{s}_prediction` (s=1..5) | card id from that station's `cards` map in `stem-notebook-config.js` | that station's **lab game** (`game1/3/5/7/9.html`) — **not built yet** | `stem/notebook.html` |
| `stem_station{s}_result` | card id, same `cards` map as `_prediction` (same set of options — the lab game re-uses its own catalog for the measured outcome) | that station's lab game, on the "מה מדדתי במטבח" step — **not built yet** | `stem/notebook.html` |
| `stem_station{s}_conclusion` | card id from that station's `conclusionCards` map | that station's lab game, on the conclusion step — **not built yet** | `stem/notebook.html` |
| `stem_station{s}_sticker` | `'1'` flag | that station's **sorting game** (`game2/4/6/8/10.html`), on completion — **not built yet** | `final_screen.html` (built); `stem/notebook.html` (built) |
| `stem_unlocked` | `'true'` flag (purchase entitlement) | `stem/access-guard.js` (`setCachedUnlocked`, after a cold-cache RC verify on native); later, `app/packages.html` on purchase/restore | `stem/access-guard.js` (gate on every stem page load) |
| `stem_access_rechecked` | sessionStorage flag | `stem/access-guard.js` | `stem/access-guard.js` (same file — background RC recheck runs at most once per session) |

No flat-sum `stem_stars` key, no legacy/duplicate key pair — per this doc's
own "no dead keys" / "no dual canonical/legacy key pairs" principles above.

**`stem/notebook.html` is now built** (linked from a new "📓 מחברת המדען שלי"
button on the hub, below the progress card). It's a pure reader of the four
per-station keys above — never writes any of them — and renders a per-station
page (prediction chip / result chip + a non-judgmental match note / conclusion
chip with a ⭐ on the correct one) plus a 5-bar summary chart of how many of
the 3 fields (prediction/result/conclusion) are filled per station. A locked
station shows 🔒; an unlocked-but-not-yet-played one shows an empty-state
line, never a false "0" or blank card.

**`www/assets/stem-notebook-config.js` (new, shared) is the single source of
truth for card ids.** It exports `StemNotebookConfig.NOTEBOOK_STATIONS`, a
5-entry array (same 0-indexed order as `unlock-logic.js`'s `STATIONS`) — each
entry has `predictionQ` (the question shown above the chip), `cards` (the id
→ {icon, label} map shared by `_prediction` and `_result`, since both are the
same physical comparison — e.g. station 0's `a`/`b`/`c` cups), `correctResult`
(which id is the real measured outcome — used only for the notebook's gentle
"ניחשתם בדיוק! / יצא אחרת" note, never a pass/fail grade), `conclusionQ`, and
`conclusionCards` (id → {icon, label, correct?} — exactly one `correct:true`
per station). **When game1/3/5/7/9 (the lab games) are built, each must write
only the ids already defined here for its station** — no new/ad-hoc ids — so
the notebook keeps rendering them without per-game special-casing. The
conclusion wording matches each station's already-approved recipe-page
"שורת סיום" sentence (e.g. station 1: "הריבה הסמיכה הייתה סמיכה כי ______" →
`pectin` is `correct:true`), so a child sees the same fill-in-the-blank in
the notebook as on the printed page.

**Resolved: the "shared JS module vs. inline per game" open spec question
(תבניות משחק) — shared module,** for the dial-lab template specifically.
`www/stem/dial-lab.js` (new, shared) is a generic touch-only cup-comparison
engine used by `game1.html` (yeast), `game7.html` (ice cream freeze) and
`game9.html` (volcano) — the three games the spec assigns to this template.
A page sets `window.LAB_CONFIG` (gameNum, stationIndex, theming, `unit`/
`maxScale` for the ruler, `varLabels` — 1-2 named variables e.g.
`{temp:'טמפרטורה', sugar:'סוכר'}` — `guidedCups`, `freeExtraCups`,
`maxFreeRuns`, `nextHref`) then loads `dial-lab.js`, which renders all 3
levels generically:
- **Level 1 (guided):** tap a cup to record `stem_station{s}_prediction`,
  then "התחילו!" animates all `guidedCups` (bubble CSS animation → liquid
  fills to `resultCm/maxScale`), writes `stem_station{s}_result` as the
  highest-`resultCm` cup's id, shows a non-judgmental match note.
- **Level 2 (free):** child picks any 2 cups from the full pool (guided +
  extra); `varLabels` drives a live "fair test" note under the compare
  button — Bito-style, never blocking — comparing how many of the named
  variables differ between the two picked cups (0/1 differ → encouraging
  note or none; 2+ differ → gentle "קשה לדעת מה גרם להבדל" note). A config
  with only one `varLabels` key (game7 - salt amount is the only variable)
  can never trigger the 2+ warning, so the note only ever encourages there.
  Capped at `maxFreeRuns` runs (game1/game7: 3; game9: 4, per spec).
- **Level 3 (conclusion):** renders that station's own `conclusionQ`/
  `conclusionCards` straight from `stem-notebook-config.js` (not a separate
  question) — single source of truth with the notebook, then writes
  `stem_game{n}_completed` and offers "🧩 בואו נרכיב את הניסוי" →
  `nextHref` (that station's sorting game) or back to the hub.

game9's free level enumerates the soda×vinegar grid from the Asana task's
own model table (7 extra cups) so kids can discover both "החומץ נגמר" (all
soda amounts plateau at the same low height when vinegar=50ml) and "עודף
סודה מעבר לכף אחת לא עוזר" (the tbsp and 2-tbsp rows are identical) —
neither is spelled out as text, both are discoverable by comparing cups.
All three games verified end-to-end in Playwright: correct
prediction/result/conclusion keys written, fair-test note correctly
computed for both single- and dual-variable configs.

**`game3.html` (connect-net template, jam/pectin) is now built** — inline,
single-use (per italy's own precedent for a game that isn't reused
elsewhere, unlike dial-lab which spans 3 games). Flow: prediction (shared
`cards`, same as every other station) → a static, non-interactive level-1
demo (5 "strawberry" dots, a sparse pre-drawn net, "אין מספיק חוטים" —
per the spec's "בלי הפסד", this level literally cannot be attempted/failed,
it's illustration only) → the real interactive level (17 dots — 5 red
"strawberry" + 12 green "apple" — over 12 slowly-drifting 💧 divs with
simple edge-bounce physics; tapping dots in sequence draws connecting
lines, "🔒 סגרו את הצורה" closes the tapped path into a polygon and runs a
ray-casting point-in-polygon test against every uncaught drop, catching
(fading out) any drop inside; target 10/12 per the spec) → a cold-plate
tilt-test (two plates, the apple one visibly stays put, the strawberries-
only one spreads — writes `stem_station2_result`) → the shared conclusion
screen. **Level 3 from the Asana task (picking 3 of 5 "helper" ingredients)
was dropped**, per that same task's own "אפשר להוריד" reduction note.
Verified in Playwright: closing several triangles across the canvas
reliably reaches the 10/12 catch target, all four keys
(`_prediction`/`_result`/`_conclusion`/`stem_game3_completed`) write
correctly.

Still not built: **מיון והסקה** (template 3, cabbage/game5) — a genuinely
new drag-to-basket + mystery-liquid mechanic, doesn't fit any existing
template.

**The 5 sorting games (`game2/4/6/8/10.html`) are now built**, copied from
`italy/game2.html`'s drag-to-reorder template (per the spec's own note that
this template "is duplicated from an existing file") with the italy-specific
bits removed: no `italy_stars`/`italy_stars_detail` keys, no
`dinner/station-flow.js`. Each writes exactly the two keys the contract
above gives it — `stem_game{n}_completed` and `stem_station{s}_sticker` —
and nothing else; the on-screen 3-star rating is session-only positive
feedback, never persisted (stem has no stars/score key at all). Each uses
its station's 5 already-produced `assets/cards/station{s}_card_{1-5}.png`
(card N is step N, per the spec's own numbered step lists — not guessed),
and after a correct solve offers "📋 צפו בדף הניסוי המלא" showing that
station's `assets/recipes/recipe_page_*.png`, mirroring italy's
recipe-reveal-on-completion pattern. Verified in Playwright (game2): correct
order → both keys written, incorrect/partial order → hint text + retry, no
dead end.
