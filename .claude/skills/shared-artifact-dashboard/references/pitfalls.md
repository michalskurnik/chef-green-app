# Pitfalls: incidents and root causes

Read before changing the data layer, menus, forms or layout. Each entry: symptom, cause, fix, the test that guards it.

## Data and publishing

**Republish loop (240 page versions in an afternoon).**
Symptom: version number climbs nonstop while tabs are open; your publishes are refused again and again.
Cause: a release tombstone hid a re-created release, so `localAhead()` was always true and every tab republished on load.
Fix: tombstones expire when a doc with newer `createdAt` appears; creation clears the tombstone; auto-republish at most every 2 minutes; skip publishing when the canonical signature equals the seed's.
Test: re-create a deleted version, reload, expect no publish.

**Publish copy built from a filtered view.**
Cause risk: switching projects would change the signature and republish.
Fix: `buildDoc` and `sigOf` use `allItems/allReleases/allLogs/projects`.

**Reused task numbers.**
Cause: next number computed only from current items; deleted items' numbers came back.
Fix: max over items, unsynced local items and log keys (`^SYM-(\d+)`), per project, plus a floor that only grows.

**Partial multi-step writes reported as success.**
Fix: count successes; toast "only 7 of 9 saved"; retry with backoff; disable the button during the operation.

**Identity shown as "unknown" in the log.**
Fix: map user ids to names; the owner is detected with `isOwner()`.

**Archived data unreachable or missing from backups.**
Fix: an "Archived" section in the versions menu with restore; exports iterate all versions.

## Menus, forms, focus

**Dropdown or new-version card vanishes when the mouse moves over it.**
Cause: closed on `window.resize`; inside the claude.ai iframe, resize fires as host toolbars show and hide.
Fix: reposition on resize; keep it open across redraws; do not steal focus when re-opening.
Test: iframe repro that dispatches resize on every mouse move (testing.md).

**Form text erased while typing.**
Cause: a data snapshot re-rendered the panel.
Fix: keep form state in a variable and re-render from it; `editingIn(panel)` defers panel redraws while focus is inside; publishing waits while anyone types.

**Open native select closes on refresh.**
Cause: options rebuilt on every render.
Fix: build options once; only set value and classes on refresh.

## Layout

**Controls 2px taller than their neighbours.** Missing `box-sizing:border-box` on some controls. Test: all controls in a row share height, radius, font size and family.

**Dropdowns squeezed on the phone** (shipped for three versions). Cause: a global `flex-wrap:nowrap` on the filter row; the phone test only checked "on screen". Fix: wrap on the phone, `flex:none` on controls. Test: `select.scrollWidth <= select.clientWidth` for every dropdown at 390px.

**Row wraps at 1280 after a "small" spacing change.** The row had 20px of slack. Fix: smaller variant for 961-1340px. Test: one-line check at 1280 in every layout test.

**Huge gaps after spreading a row.** `justify-content:space-between` or auto margins distribute everything. Fix: capped spacers.

**Title wraps to two lines.** Add `white-space:nowrap` and a smaller size at narrow widths; hide secondary chips below 1320px before the title wraps.

## Process

**A requested change "was not done".** It was built but a publish was blocked, and the report did not say so. Rule: the first line of a report says what is live and what is not.

**Patch half-applied.** A suite assertion failed after the template was already written. Rule: all assertions first, all writes last; back up before every patch.

**Tests that cannot fail.** Checking for an op name the mock never records (`delete` vs `del`), or "on screen" instead of "readable". Rule: before trusting a new test, break the feature once and see it fail, or reason about which broken state it would catch.

**Shell heredocs blocked by a classifier.** Write scripts with the Write tool and run the file.

**Misreading the request.** "Make the buttons uniform" meant the buttons too, not only the filters. Re-read the user's message against your change list before reporting; when unsure, quote back what you changed.

## Found while packaging this skill

**Long project names clip the version capsule.** The measurement script caught the capsule cut off at 1440px once the title was "Tasks of <long name>", and the status chips wrapped onto two lines. Fix: in the top line only the title may shrink (`min-width:0; max-width:clamp(150px,17vw,340px); text-overflow:ellipsis`, full name in `title`); the capsule and chips get `flex-shrink:0` and the chips `flex-wrap:nowrap`. Test with the longest realistic name, not the current one.

**A full row wraps as soon as a conditional control appears.** At 1280px the filter row had about 20px of slack; choosing any filter shows the "clear" button and the row broke onto two lines. Found by a comparison run, not by the suite, because every layout test measured the default state. Fix: at narrow widths "clear" becomes an x icon (`font-size:0` + `::before`) with `aria-label` and `title`, and the tabs lose 2px of padding. Test layout in the active states too: a filter set, a menu open, a long name, the clear button visible.

**Hidden elements counted in layout tests.** A hidden chip has a rect at top 0 and turns "1 line" into "2 lines". Filter by `offsetWidth` before measuring.

**Outside-click close that closes on inside clicks.** A document click handler in the bubble phase runs after the card's own handlers; if those re-rendered the card, the event target is detached and looks "outside". Listen in the capture phase, ignore targets no longer in the document, and ignore clicks inside floating menus and dialogs.

**Equal-width button grid collapsing to one column.** `repeat(auto-fit, minmax(112px,150px))` counts columns by the maximum (150px), so a 300px card got one button per row. Use `minmax(104px,1fr)` with a `max-width` on the grid and `margin-inline:auto` to keep it centered.

**External write invisible to the people it was meant for.** Another session wrote its question into an item's `note` and stamped an earlier time than the real write. The closed card shows no note and the waiting tab lists only requests, so nobody noticed; the backdated stamp could also be hidden by a pending local edit. Fix: rules in `external-writers.md` (real time, assign and move status, or create a request).

**Database changed, page copy stale, user sees old data (happened twice).** Writes made with ArtifactData (by another session at 11:13, then by Claude at 11:32) were not followed by a republish. The user's view kept showing the page's embedded copy: either its live subscription had died silently (a terminal `unavailable` ends a listener; only a new subscription recovers) or it was fed a copy saved on an earlier visit (`fromCache`), which the page treated as current. Fixes: the invariant "page copy == database" with `check_copy_vs_db.py` after every write and publish; page-side freshness tracking, stale warning, and automatic resubscribe (starter test 9, board tests 47a-g).

**Third time: screenshots attached, nobody saw them.** Another session uploaded two screenshots as assets and added them to GC-5's `files` (correct format), but did not republish. The user refreshed several times and saw no images: the live page's embedded copy was 30 minutes older, and the user reported that the view did not update from the database (the cause in their browser was not verified; no browser was attached). A republish from a fresh dump fixed what the user sees; the live connection problem in that viewer is a separate, platform-side condition the page can only report (stale ring and toast), not repair. Rule: an external write is not done until the page copy is republished (`external-writers.md` rule 9) - say so in the hand-off to any other session.

**Image thumbnails too small to be useful.** Files rendered as 64px cropped squares; a phone screenshot is unreadable at that size, so "I can't see the image" was literally true. In an expanded card show images as previews 240px tall (200px on phones), `object-fit:contain`, with the file name (without extension) under each; a click opens an in-page viewer (board tests 48d-48j).

**CSS class name collision.** A new caption class `fcap` was already the filter label's class, whose `::before` draws a funnel icon, so every caption got a funnel. Before adding a class, `grep -c "\.name\b"` the template; prefer names scoped by the component (`.ci-files .fname`).

**"This link cannot be opened here".** Screenshot tiles were links with `target=_blank` to `/_blob/<id>`; claude.ai's viewer blocks opening them. Nothing in a local test shows this (the mock page opens links freely), so the rule is structural: no new-tab links or `window.open` on a board; images open in an in-page viewer, other files download through `downloads`. Test 48c/48d assert there are no `<a>` elements in a card's files.

**Fourth time, and a future timestamp.** Another session updated five tickets and uploaded 10 screenshots, reported them as updated, and did not republish; the user saw none of it. It also stamped `updatedAt` 16:20:00 on writes made around 16:14. Fixes: the hand-off text at the end of `external-writers.md`, and a "send diagnostics" button on the board (technical details tab) that writes the viewer's connection log to `data/users/<id>/diag`, readable by Claude as that user with `ArtifactData get collection:"data/users/me" doc_id:"diag"` - the only way to see why one person's view is not receiving live data when no computer is attached (board tests 50a-b).

**Phone: the version capsule hid its four buttons.** After archive and delete were added, the capsule needed 461px on a 316px phone row; with `overflow:hidden` the percentage and the manage, add, archive and delete buttons were cut off, unseen for many versions because the phone tests only checked page scroll. Fix: under 600px the capsule wraps to two rows. Test 53b clicks the center of every capsule button via `elementFromPoint`.

**Phone: tall empty gaps in the versions pane.** A `flex-wrap:wrap` row inside a pane that fills the screen height spreads its lines over the whole height (`align-content` defaults to stretch): 372px gaps between the title, chips and capsule. Fix: `align-content:flex-start`. Test 53a.

**Seed matching trap.** The page's own self-republish code contains the text `<script type="application/json" id="seed">` inside a JS string, so a naive regex finds two blocks and a non-greedy match can swallow the whole script. All scripts match only a block whose content starts with `{`; `refresh_seed.py` refuses unless exactly one matches.

**Copy time shown in UTC.** The seed stamp was formatted in UTC, so Israeli viewers read "copy from 16:26" at 18:26. The seed now carries `atIso` and the page shows it in the viewer's local time (test 52b).

**12-second popup.** The early "not updating" toast fired on slow starts and was then ignored; the real problem went unnoticed. Now: quiet ring at 12s, loud banner only after a full visible minute (section 7e of ui-patterns.md).

**"Constantly connecting" and the banner after a minute.** Two causes, both in the board's own code: (1) the page republished itself after every edit, and every publish reloads every open view, so each teammate's edit restarted everyone's board; (2) the reconnect wait doubled on every drop and never reset after a successful reconnect, so after a few drops it exceeded a minute. Fixes: no publish after ordinary edits (architecture.md section 7); the wait resets on confirmed data, is capped at 30 s, and is skipped when the tab becomes visible or the network returns; the ring waits ~10 s instead of flashing on every drop. Tests 4b, 28b, 47e, 51c, 54a-e; tests 54c and 54d fail on the old code.

**Saved on my screen, missing for everyone else.** A teammate's page showed her status changes, but four log entries and one item update never reached the database: `patch()` tried once and only showed a toast on failure, log writes gave up after three tries, and the change lived on only in her browser's local copy, which the old self-republish then baked into the page copy. Fix: the outbox (architecture.md section 7) resends unsaved changes safely until they land, and the page never republishes local-only data. Tests 6d, 27b, 55a-d.

**THE root cause of "the board does not update": frozen snapshot data in strict mode.** The platform delivers every snapshot's `data()` frozen (db.d.ts says so). The page code runs with `'use strict'` and did `var o=d.data(); o.id=d.id;` - assigning to a frozen object throws `TypeError: Cannot assign to read only property 'id'`, which killed `applySnap()` after it had counted the answer. Every confirmed answer from the database was received and thrown away; boards showed only their embedded page copy, for every viewer, all along. That is why external writes "never arrived" without a republish, why the page copy mattered so much, and why the sync warning fired although diagnostics counted 3 confirmed snapshots per collection. Fix: copy first (`Object.assign({}, d.data())`), and wrap the mapping in try/catch that writes the error to the diagnostics. The test mock missed it because it delivered plain objects; `mock_runtime.js` and the board suite now freeze `data()` exactly like the platform (board test 56 fails on the old code with the same TypeError). Rule: never mutate anything a platform API returns; copy it first. Found only through the viewer's diagnostics (sent with one click to `data/users/<id>/diag`).
