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
