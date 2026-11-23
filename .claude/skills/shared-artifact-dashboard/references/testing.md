# Testing a board

## Harness

`scripts/test_harness.js` loads the built page in Chromium (Playwright, preinstalled in cloud sessions) with a mocked runtime injected before any page script:

- `window.claude.use('db')` returns collections whose `get()` never resolves (the page shows the seed), `onSnapshot(fn)` stores `fn` in `window.__snap[col]`, and writes are recorded in `window.__w` as `['add',col,title]`, `['update',col,id,json]`, `['set',col,id]`, `['del',col,id]`.
- `use('artifact').publish(html)` records into `window.__pub`.
- `use('user')`: `id()`, `isOwner()`; `use('permissions').state()` returns `granted`.
- `fire(page,col)` replays the seed's collection as a live snapshot (simulates another user's update arriving).
- `fresh(width)` opens a new context at that width; `ok(cond,msg)` prints PASS/FAIL and counts failures.

Run: `node suite.js > runNN.txt; grep -v '^PASS' runNN.txt; grep -c '^PASS' runNN.txt`. The harness writes `suite.html` (the built page wrapped like the platform does) next to itself.

## Writing tests that can fail

- Name every test with its number and a sentence describing the expected behaviour; include measured values in the message (`JSON.stringify(r)`) so a failure explains itself.
- Wrap each test in `{ ... }`.
- Assert on what the user sees: computed styles, bounding boxes, text, `aria-*` states. For writes, assert on `__w` entries.
- Thresholds must exclude the broken state you are guarding against (for example "gap between 10 and 16px", not "gap >= 0").
- After a deliberate design change, update old expectations and say so in the report; never loosen a test to hide a real bug.

## Test catalog (every board should have these)

Data
- create item: key format `SYM-n`, numbers never reused after delete
- edit with a data refresh in between: no lost text, no lost focus
- delete with confirmation; nothing written before confirming
- create version with template tasks; partial failure toast (mock `add` throws for one title)
- delete and re-create a version: no republish loop
- publish skipped when data equals the page copy
- archive and restore a version; archived listed in the menu; export includes it
- projects: create, duplicate symbol rejected, switch, separate numbering and version ids, choice remembered after reload, rename

UI behaviour
- versions menu and new-version form survive resize events and data refreshes while the mouse moves over them
- filter dropdowns: change, highlight, combine, clear resets; open dropdown survives a refresh
- view toggle from another tab brings the task list into view; typing a search from another tab shows results
- tabs: each tab shows only its panel
- expanded card: labelled sections, empty fields hidden, files section with images
- floating card window: opens from the icon (closed or open card), closes on the board first, never reopens on close; Escape / close button / backdrop click (several points) close it; drag-select from inside does not; Tab stays inside; page behind inert; typing survives live updates; Escape while typing saves first

Layout (at 1280, 1440, 1600, 1920 and 390)
- top line and filter row each on one line on desktop; nothing clipped (`scrollWidth <= clientWidth` on capsules); no horizontal page scroll
- uniform height, radius, font in each row
- gaps within agreed ranges; leftover space distributed
- phone: everything visible, wrapped, no squeezed control
- contrast of primary button text >= 4.5 in light and dark
- title on one line

## Realistic host repro

Some bugs only appear inside the claude.ai iframe. Build a host page that embeds `suite.html` in an iframe and changes the iframe height by 1px on every `mousemove`, then drive the real mouse over the menu (see `measure_layout.js` options or write `repro.js`). Use it whenever a user reports "it disappears when I hover".

## Screenshots

Take them at `deviceScaleFactor:1` for your own checks, 2 for images the user will see. Always look at light, dark and phone after a visual change, and at the open state of any menu or dialog you touched.
