---
name: shared-artifact-dashboard
description: Build and run shared, database-backed claude.ai Artifact boards (task, kanban, bug and release trackers). Use for a new board, any change or publish issue, or updating its tickets.
---

# Shared Artifact boards

Distilled from a long real session that built and ran a bilingual (Hebrew RTL) task-and-release board used daily by two people: ~50 iterations, 170 automated tests, several production incidents and their fixes. The point of this skill is to get the next board right the first time and to change existing ones without breaking them.

Two other skills hold the platform contract; load them first when they are listed: `artifact-design` (page contract, theming, size limits) and `artifact-capabilities` (db, artifact.publish, user, downloads, mcp). This skill is the layer above them: how to build and operate a real multi-user board.

## Never mutate platform data

Snapshot `data()` objects are frozen; the board runs in strict mode. Copy before you add or change a field (`Object.assign({}, d.data())`). Mutating one silently dropped every live answer for a whole day of debugging (`references/pitfalls.md`, last entry). The test mock must freeze `data()` too, or this class of bug stays invisible.

## Choose your path

- **Only updating tickets on an existing board** (you fixed bugs elsewhere and report back, attach screenshots, change status or owner, add an item) - any session, including a teammate's: follow "Updating tickets" right below. No template, test suite or build setup is needed.
- **Building or changing the board itself** (layout, features, data layer): "When starting" and "The build loop".

Both paths need the `Artifact` and `ArtifactData` tools and a shell (Claude Code, or a claude.ai session that has them). Scripts are in this skill's `scripts/` folder.

## Updating tickets (any session, no template needed)

A ticket update is finished only when the database has it AND the board page's embedded copy has it. A viewer whose live connection fails sees only that copy; skipping step 5 made a teammate's updates invisible four times.

1. **Dump** every collection: `ArtifactData list` for `items`, `releases`, `log`, `projects`, each with `query:{limit:1000}` and the same `out_dir` (e.g. `dump1/`).
2. **Write** following `references/external-writers.md`: real UTC time from `date -u` right before writing (never rounded or in the future), `if_version` from the document you read, `update` only the changed fields, a `log` entry in the same `batch`, the board's own enum values, screenshots uploaded as assets and appended to the item's existing `files` array.
3. **Verify** the write: `get` each written doc; dump again (`dump2/`); `python3 scripts/validate_data.py <live index.html> dump2` must report 0 errors.
4. **Read the live page**: `Artifact read url:<board> path:"index.html"` (it is saved to a local file).
5. **Refresh and publish the page copy**: `python3 scripts/refresh_seed.py <that index.html> dump2 publish.html`, then `Artifact publish url:<board> file_path:publish.html`. Only the data block changes; the page code stays exactly as published.
   - Refused with "a newer version saved from inside the page": someone's page republished itself. Read the saved file the refusal names (Read tool, a few lines are enough), dump again, rerun `refresh_seed.py` on THAT saved file, publish again; if refused as "identical content", publish the same file once more.
   - Refused because you may not publish (no edit rights): stop and say so plainly (step 7).
6. **Confirm**: `Artifact read path:"index.html"` again, then `python3 scripts/check_copy_vs_db.py <live index.html> dump2` must print "page copy matches the database".
7. **Report**: the keys created and updated, and one line "Board page republished: yes" or "Board page republished: NO - ask the board owner's session to republish". Never say the changes are visible on the board when step 6 did not pass.

The board's tools tab ("ייצוא וגיבוי") shows the same rules for its own project, ready to copy into a session that has not loaded this skill.

## When starting

1. **New board?** Start from `assets/board-template.html` (the full working board with images stripped) unless the request is tiny. It already contains every hard-won fix listed in `references/pitfalls.md`. Rename strings, prune what is not needed, keep the data layer. Read `references/architecture.md` before touching the data layer.
2. **Existing board?** Find its source of truth: a local template (`*.tpl.html` with a `__SEED__` placeholder) or the published page (`Artifact read` with `path:"index.html"`). Never rebuild from memory.
3. Set up the work folder (scratchpad): template, `build_seed.py`, test suite, data dump folder `dbrealN/` (see "Build loop").

## The build loop (every change, no exceptions)

The loop exists because each skipped step in the original session caused a visible regression in front of the user.

1. **Back up** the template and the suite: `cp tpl vNN.bak`, `cp suite.js suiteNN.bak`. Restoring is then one command when a patch half-applies.
2. **Patch with a script, not by hand.** Write `patch_tplNN.py` using `scripts/patch_util.py` (`rep(old,new,count)` asserts the exact match count; `add_css()` appends a commented, versioned CSS block). Put every assertion before the first write, so a failed check never leaves a half-patched file. Write scripts to files with the Write tool; do not put heredocs in shell commands (safety classifiers block them and you lose the step).
3. **Add or update tests in the same patch** (`patch_suiteNN.py`). A change without a test regresses later. Each new test goes in its own `{ ... }` block (shared `const` names collide in a long suite). Make sure the test can fail: check the mock's real op names, compare to a threshold that the broken state violates.
4. **Build** with test data: `python3 scripts/build_seed.py <template> <dumpdir> <out.html>`. Keep a frozen dump for tests (stable expectations) and a fresh dump for publishing, built to two different output files (e.g. `test.html` read by the suite, `publish.html` sent to the Artifact tool): sharing one file once made the suite run on live data and crash.
5. **Run the full suite**, not just the new tests (`node suite.js > runNN.txt; grep -v '^PASS' runNN.txt`). Old tests that fail because the user asked for that exact change: update their expectation and say so. Any other failure is a real bug.
6. **Measure and look.** Run `scripts/measure_layout.js` (one-line checks, gaps, overflow, clipped controls) and take screenshots at 1280/1440/1600/1920 and a 390px phone, light and dark. Read the screenshots yourself. Numbers catch regressions; eyes catch ugliness. Measure with the longest realistic content (long project and version names, many filters) and in active states (a filter set so "clear" shows, a menu open), not only the default screen: a short name hid a clipped control, and the default state hid a row that wrapped as soon as a filter was chosen.
7. **Publish** following `references/publish-protocol.md`: fresh data first, then publish, then verify the live file equals the build.
8. **Report** (see "Reporting").

When the user sends new requests mid-turn, finish and verify the step in progress, publish what is done if it is self-contained, then take the new request. If they say "after you finish X, do Y", do it in that order and say so.

## Architecture in one screen

Full details and code in `references/architecture.md`.

- **One HTML file**, published as an Artifact, with capabilities `db` (shared collections), `artifact` (self-republish), `user`, optionally `downloads`, `mcp`.
- **Collections**: `items` (tasks), `releases` (versions), `log` (audit trail), `projects`. Every doc carries `updatedAt`; items carry a `project` field (missing = default project).
- **Seed**: the page embeds `<script type="application/json" id="seed">` with a recent copy of all data, so it renders instantly and offline; live snapshots replace it.
- **Local copy** in `localStorage` holds unsynced writes with `_base` (the version they were based on) plus tombstones for deletes; `merged(col)` combines live/seed with local copies.
- **Page republish (rare, never after ordinary edits)**: every publish reloads EVERY open view of the board, so republishing after each edit made everyone's board reconnect again and again. Edits go to the database only; live snapshots carry them to everyone. The page copy is refreshed by Claude sessions after their writes, by a manual "עדכון העותק השמור בדף" button, and on load for a viewer's own edits that never reached the page (`localAhead()`). Guard every publish: skip when the canonical signature of all data equals the seed's; at most one automatic republish per 2 minutes; never trigger from a filtered view. The platform rule is "publish only after a viewer acts, never on load": the only on-load publish allowed is for that viewer's own unsynced earlier edits (`localAhead()`); never republish because live data differs from the seed - refreshing the copy is Claude's job (see the invariant below).
- **Views are filters over `all*` arrays** (project, version, type, status, owner...). The publish copy and its signature always use the unfiltered arrays.

## UI kit that the user approved

Compact, calm, uniform. Patterns and CSS in `references/ui-patterns.md`. The short version:

- **Top line** (one line at 1280+): logo + title "X of <project>", status chips, a **version capsule** (dropdown of versions with progress %, manage, +, archive, delete), a **project picker**, then search, primary button and view toggle. Spare room is shared evenly between groups with capped gaps, never `space-between` across the whole row.
- **Second row**: a short visible label before the tabs ("Show:") and next to the filter icon ("Filter:"), then uniform dropdown filters (type, status, sort, owner, severity, package, source) and a "clear" link that appears only when something is filtered.
- **Every control in a row**: same height (30px, `box-sizing:border-box`), same corner radius (8px), same font. One filled primary button; red only for destructive actions. Dropdowns highlight when changed from default (applied-filter feedback).
- **Background**: neutral `#F3F4F1` with white surfaces (dark: `#121513` / `#1C211E`), optional faint geometric SVG pattern; text contrast at least 4.5:1.
- **Phone (390px)**: everything wraps without sideways scrolling, no control squeezed.

Spacing changes are where users push back most. Change gaps by a few pixels at a time, measure before and after, and report the numbers per screen width.

## Invariant: the page copy always equals the database (never skip)

A viewer whose live connection fails, or who gets an old saved copy, sees the page's embedded copy. Twice a user saw stale data because a database write (by another session, then by Claude) was not followed by a republish. So:

- After ANY database write you make (ArtifactData set/update/batch/delete), in the same turn: re-read the written docs, take a fresh dump, rebuild, publish, then run `scripts/verify_live.sh` AND `scripts/check_copy_vs_db.py <live index.html> <fresh dump>`. Exit 0 from both is the definition of done. Never tell the user a change is visible before both pass.
- Before telling the user anything about what they "should see", run `check_copy_vs_db.py` against the live page; if it reports a mismatch, rebuild and republish first.
- The page itself must track freshness (template code, tested by starter test 9): a snapshot with `metadata.fromCache` is merged per document by newer `updatedAt` and never replaces confirmed data or clears local copies; no confirmed data within 12s or a terminal subscription error shows a visible stale warning (gold ring on the logo, no layout shift) and a one-time toast; a terminal `unavailable` error resubscribes with backoff.

## Publishing (short)

Full protocol and recovery steps: `references/publish-protocol.md`.

- Fetch fresh data (`ArtifactData list ... out_dir`, or a `query` on `updatedAt > last dump`) and rebuild with it before every publish, so the published seed contains the users' latest edits.
- "Publish refused - newer version saved from inside the page": a user's page republished itself. Run `scripts/compare_live.py` (saved file vs your build vs fresh dump). If the data matches, Read the saved file with the Read tool (the publish gate requires an actual Read; a script reading it does not count), then publish again as a separate step (not in parallel with the Read); if that is refused as "identical content", publish the same file once more. If the data differs, dump again, rebuild, publish.
- After publishing, `Artifact read path:"index.html"` and run `scripts/verify_live.sh <build> <live>`: zero lines missing from live, only the 5 wrapper lines added.

## Writing to the database from outside the page

Other sessions (Claude Code in a terminal or IDE) may update items directly with ArtifactData. Follow `references/external-writers.md`: real UTC time in `updatedAt`, `if_version` pin, `update` only the changed fields, board enum values, a log entry in the same batch, re-read to verify, then `scripts/validate_data.py`. A backdated timestamp can hide the change in a tab with a pending local edit.

## Reporting to the user

- First line: what is live now (version number and link) and what is not, if anything is blocked. A built-but-unpublished change is not done.
- What changed, in the user's terms, with measured numbers where layout changed (e.g., "gap between project and search: 78 to 27 px at 1600").
- How it was verified: test count, which new tests, screenshots taken, live file compared.
- Limits, honestly flagged: what you could not check (for example, the user's own browser when no computer is attached), behaviour you inferred, any test that is weak.
- Do not claim a browser check you did not run. If the user requires checks in their browser and no computer is attached, give them a short checklist prompt for their browser agent.

## Bundled files

- `scripts/patch_util.py` - `rep()`, `add_css()`, `backup()`; import it in every patch script.
- `scripts/build_seed.py` - template + DB dump folder -> publishable HTML (seed injected, `</` escaped).
- `scripts/test_harness.js` - mocked `window.claude` (db, artifact, user, permissions), `fresh()`, `fire()`, `ok()`, a starter suite you extend. Run with Node + Playwright (preinstalled in cloud sessions).
- `scripts/measure_layout.js` - per-width JSON: row line counts, gaps, overflow, clipped/squeezed controls; plus screenshots.
- `scripts/compare_live.py` - page-saved HTML vs build vs dump: data and code equality per collection.
- `scripts/verify_live.sh` - live file equals build except the platform wrapper.
- `scripts/check_copy_vs_db.py` - the page's embedded copy vs a fresh database dump; exit 1 on any difference (run after every publish and every database write).
- `scripts/refresh_seed.py` - replaces only the data block of a published page (the live `index.html`) with a fresh dump; for sessions that update tickets without the template (see "Updating tickets").
- `scripts/validate_data.py` - checks a data dump against the template's own enums: valid values, releases and projects exist, unique numbers, log keys, timestamps; lists writes made outside the page.
- `references/architecture.md` - data layer, merge, tombstones, numbering, self-republish guards, multi-project, Google Docs mirror.
- `references/publish-protocol.md` - every publish refusal seen and its exact remedy.
- `references/ui-patterns.md` - toolbar, dropdowns, capsule, menus that survive resize, archive/restore, project picker, research sources.
- `references/testing.md` - the test catalog (what every board must test) and how to write tests that can fail.
- `references/pitfalls.md` - incidents and their root causes; read before changing data, menus, forms or layout.
- `references/external-writers.md` - rules for other sessions that write straight to the board's database.
- `assets/board-template.html` - full working board (images replaced by a placeholder SVG); `__SEED__` marks the seed.
