---
name: shared-artifact-boards
description: Build, extend and operate shared, data-backed dashboards and boards as claude.ai Artifacts - task boards, kanban/column views, bug and feedback trackers, release/version trackers, multi-project boards, sign-up or status pages that several people edit together - quickly and without regressions. Covers the single-file HTML + shared database architecture, self-republishing page copies, Playwright test harness with a mocked runtime, layout measurement, safe publishing (conflict merges, live verification), RTL/Hebrew UIs and a proven compact UI kit (uniform toolbar, filter dropdowns, version capsule, project picker). Use this skill whenever the user wants to create or change a dashboard, board, tracker or any interactive Artifact that stores shared data, asks to fix a bug or tweak layout/spacing/filters/buttons on such an Artifact, mentions "the board", "the dashboard", versions/releases, tasks, filters, projects, or pastes a "Publish refused" error - even if they never say "skill" or "Artifact".
---

# Shared Artifact boards

Distilled from a long real session that built and ran a bilingual (Hebrew RTL) task-and-release board used daily by two people: ~50 iterations, 170 automated tests, several production incidents and their fixes. The point of this skill is to get the next board right the first time and to change existing ones without breaking them.

Two other skills hold the platform contract; load them first when they are listed: `artifact-design` (page contract, theming, size limits) and `artifact-capabilities` (db, artifact.publish, user, downloads, mcp). This skill is the layer above them: how to build and operate a real multi-user board.

## When starting

1. **New board?** Start from `assets/board-template.html` (the full working board with images stripped) unless the request is tiny. It already contains every hard-won fix listed in `references/pitfalls.md`. Rename strings, prune what is not needed, keep the data layer. Read `references/architecture.md` before touching the data layer.
2. **Existing board?** Find its source of truth: a local template (`*.tpl.html` with a `__SEED__` placeholder) or the published page (`Artifact read` with `path:"index.html"`). Never rebuild from memory.
3. Set up the work folder (scratchpad): template, `build_seed.py`, test suite, data dump folder `dbrealN/` (see "Build loop").

## The build loop (every change, no exceptions)

The loop exists because each skipped step in the original session caused a visible regression in front of the user.

1. **Back up** the template and the suite: `cp tpl vNN.bak`, `cp suite.js suiteNN.bak`. Restoring is then one command when a patch half-applies.
2. **Patch with a script, not by hand.** Write `patch_tplNN.py` using `scripts/patch_util.py` (`rep(old,new,count)` asserts the exact match count; `add_css()` appends a commented, versioned CSS block). Put every assertion before the first write, so a failed check never leaves a half-patched file. Write scripts to files with the Write tool; do not put heredocs in shell commands (safety classifiers block them and you lose the step).
3. **Add or update tests in the same patch** (`patch_suiteNN.py`). A change without a test regresses later. Each new test goes in its own `{ ... }` block (shared `const` names collide in a long suite). Make sure the test can fail: check the mock's real op names, compare to a threshold that the broken state violates.
4. **Build** with test data: `python3 scripts/build_seed.py <template> <dumpdir> <out.html>`. Keep a frozen dump for tests (stable expectations) and a fresh dump for publishing.
5. **Run the full suite**, not just the new tests (`node suite.js > runNN.txt; grep -v '^PASS' runNN.txt`). Old tests that fail because the user asked for that exact change: update their expectation and say so. Any other failure is a real bug.
6. **Measure and look.** Run `scripts/measure_layout.js` (one-line checks, gaps, overflow, clipped controls) and take screenshots at 1280/1440/1600/1920 and a 390px phone, light and dark. Read the screenshots yourself. Numbers catch regressions; eyes catch ugliness. Measure with the longest realistic content (long project and version names, many filters), not only today's data: a short name hid a clipped control until a longer one appeared.
7. **Publish** following `references/publish-protocol.md`: fresh data first, then publish, then verify the live file equals the build.
8. **Report** (see "Reporting").

When the user sends new requests mid-turn, finish and verify the step in progress, publish what is done if it is self-contained, then take the new request. If they say "after you finish X, do Y", do it in that order and say so.

## Architecture in one screen

Full details and code in `references/architecture.md`.

- **One HTML file**, published as an Artifact, with capabilities `db` (shared collections), `artifact` (self-republish), `user`, optionally `downloads`, `mcp`.
- **Collections**: `items` (tasks), `releases` (versions), `log` (audit trail), `projects`. Every doc carries `updatedAt`; items carry a `project` field (missing = default project).
- **Seed**: the page embeds `<script type="application/json" id="seed">` with a recent copy of all data, so it renders instantly and offline; live snapshots replace it.
- **Local copy** in `localStorage` holds unsynced writes with `_base` (the version they were based on) plus tombstones for deletes; `merged(col)` combines live/seed with local copies.
- **Self-republish**: after writes, the page rebuilds its own HTML with a fresh seed and publishes it, so the next visitor gets current data. Guard it: skip when the canonical signature of all data equals the seed's; at most one automatic republish per 2 minutes; never trigger from a filtered view.
- **Views are filters over `all*` arrays** (project, version, type, status, owner...). The publish copy and its signature always use the unfiltered arrays.

## UI kit that the user approved

Compact, calm, uniform. Patterns and CSS in `references/ui-patterns.md`. The short version:

- **Top line** (one line at 1280+): logo + title "X of <project>", status chips, a **version capsule** (dropdown of versions with progress %, manage, +, archive, delete), a **project picker**, then search, primary button and view toggle. Spare room is shared evenly between groups with capped gaps, never `space-between` across the whole row.
- **Second row**: a short visible label before the tabs ("Show:") and next to the filter icon ("Filter:"), then uniform dropdown filters (type, status, sort, owner, severity, package, source) and a "clear" link that appears only when something is filtered.
- **Every control in a row**: same height (30px, `box-sizing:border-box`), same corner radius (8px), same font. One filled primary button; red only for destructive actions. Dropdowns highlight when changed from default (applied-filter feedback).
- **Background**: neutral `#F3F4F1` with white surfaces (dark: `#121513` / `#1C211E`), optional faint geometric SVG pattern; text contrast at least 4.5:1.
- **Phone (390px)**: everything wraps without sideways scrolling, no control squeezed.

Spacing changes are where users push back most. Change gaps by a few pixels at a time, measure before and after, and report the numbers per screen width.

## Publishing (short)

Full protocol and recovery steps: `references/publish-protocol.md`.

- Fetch fresh data (`ArtifactData list ... out_dir`, or a `query` on `updatedAt > last dump`) and rebuild with it before every publish, so the published seed contains the users' latest edits.
- "Publish refused - newer version saved from inside the page": a user's page republished itself. Run `scripts/compare_live.py` (saved file vs your build vs fresh dump). If the data matches, Read the saved file with the Read tool (the publish gate requires an actual Read; a script reading it does not count), then publish again in a separate turn step (not in parallel with the Read). If the data differs, dump again, rebuild, publish.
- After publishing, `Artifact read path:"index.html"` and run `scripts/verify_live.sh <build> <live>`: zero lines missing from live, only the 5 wrapper lines added.

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
- `references/architecture.md` - data layer, merge, tombstones, numbering, self-republish guards, multi-project, Google Docs mirror.
- `references/publish-protocol.md` - every publish refusal seen and its exact remedy.
- `references/ui-patterns.md` - toolbar, dropdowns, capsule, menus that survive resize, archive/restore, project picker, research sources.
- `references/testing.md` - the test catalog (what every board must test) and how to write tests that can fail.
- `references/pitfalls.md` - incidents and their root causes; read before changing data, menus, forms or layout.
- `assets/board-template.html` - full working board (images replaced by a placeholder SVG); `__SEED__` marks the seed.
