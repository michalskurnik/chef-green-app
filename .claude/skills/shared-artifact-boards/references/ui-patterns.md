# UI patterns for compact boards

Contents: 1. Principles - 2. Layout skeleton - 3. Uniform controls - 4. Filter row - 5. Version capsule and versions menu - 6. Menus that survive the host - 7. Project picker and form - 8. Archive, restore, delete - 9. Spacing method - 10. Theme and background - 11. RTL and Hebrew - 12. Research sources

## 1. Principles (each one came from user feedback)

- Everything for the main task on as few lines as possible; no scrolling for controls. Users asked repeatedly to merge rows and shrink controls.
- One format per row. Same height, radius, font and size for dropdowns, search, buttons and toggles. Inconsistent shapes were called out as "not uniform".
- Labels visible next to icons and before groups ("Show:", "Filter:"). Icons alone are ambiguous.
- A dropdown that is not a filter does not belong among the filters (an identity picker in the filter row was read as a broken filter). Move such settings to a technical tab.
- Remove what duplicates something else (stat cards that repeat filter counts, type tags that repeat the type dropdown).
- Spacing: gentle. A full-width `space-between` spread was rejected immediately ("too much space"). Change by a few pixels and report numbers.
- Red only for destructive actions (delete). The primary action is the single filled button.

## 2. Layout skeleton

```
[logo][title "Tasks of <project>"] [chips: in development X | released Y] [version capsule] [project picker] ........ [search][+ New task][List|Columns]
[Show:] [tab][tab][tab][tab] | [funnel Filter:] [Type v][Status v][Sort v][Owner v][Severity v][Package v][Source v] [x clear]
[columns: To do | In progress | For review | Done]  (each column scrolls inside itself, cards keep their size)
```

- The top line lives in a "side" frame whose children use `display:contents` and `order` so markup order can stay semantic.
- On desktop the two frames join with no gap at full width; on the phone they become two tabs and the search/actions move back next to the task tabs (a `matchMedia('(min-width:961px)')` listener moves the DOM nodes; event listeners move with them).
- Cards: one-line title with ellipsis, small pills (type, severity, owner, status), no progress bars.

## 3. Uniform controls

```css
.fdd,.pp-btn,#view,.tasks-actions .create,.tasks-actions input[type=search]{box-sizing:border-box!important;height:30px;border-radius:8px;font-family:var(--text);font-size:.8rem}
.fdd{display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--paper)}
.fdd-k{color:var(--ink-soft);padding-inline:8px 3px}                 /* the label inside: "Type" */
.fdd select{appearance:none;border:0;background:transparent;font-weight:700;field-sizing:content;max-width:9.5em;padding-left:21px}
.fdd::after{content:"";position:absolute;left:8px;top:50%;width:8px;height:5px;margin-top:-2px;background:var(--ink-soft);clip-path:polygon(0 0,100% 0,50% 100%);pointer-events:none}
.fdd.on{border-color:var(--chef-deep);background:color-mix(in srgb,var(--chef) 16%,var(--paper))}   /* changed from default */
#view{display:inline-flex;border:1px solid var(--line);overflow:hidden}                             /* segmented toggle */
#view .opt[aria-pressed="true"]{background:color-mix(in srgb,var(--chef) 16%,var(--paper));color:var(--chef-deep)}
```

- `box-sizing:border-box` matters: without it a 30px control with a 1px border measures 32px next to 30px ones (a test caught exactly that).
- `field-sizing:content` sizes a select to its current value (Chromium; older browsers fall back to the widest option, still usable).
- Search: placeholder "Search" with a magnifier icon, full hint in `title`. Width 110-160px on 1280-1600, up to 210px on 1700+. Research suggests 27 characters, but this user preferred smaller; follow the user.

## 4. Filter row

- Native `<select>` elements wrapped in labels: accessible, keyboard friendly, no custom popover bugs.
- Build the options once at init. Data refreshes only set `.value` (and only if it differs) and toggle `.on`. Rebuilding options closes an open native dropdown under the user's mouse.
- "x clear" appears only when something differs from the defaults; it resets filters, sort and extra filters.
- Default status depends on the view (columns: all; list: open).
- Stat cards (open / blockers / late / for review / waiting / done) were removed at the user's request. If you remove such cards, say which shortcuts disappear (blockers, overdue) and offer them as options elsewhere.

## 5. Version capsule and versions menu

One rounded element: `[Version 1.2 v][status chip][target date][build][3/14 done][21%][gear][+][archive][trash]`, the progress shown as a fill behind the capsule (`--p:21%`).

- `v` opens the versions menu: one row per version with status and done/total plus a mini bar, "No version", an "Archived" section, and "+ New version".
- `+` opens the new-version form (name prefilled with the next number, "add template tasks" checkbox). The form state lives in a variable (`newRel`) so a data refresh re-renders it instead of erasing it.
- The gear opens the manage panel (target date, status, release flow, copy "what's new", delete).
- Archive: saves `status:'archived'` and `prevStatus`, switches to another version. Opening an archived version shows the same button highlighted as "restore", which puts `prevStatus` back. Without an "Archived" section in the menu an archived version is unreachable.
- Trash: opens the manage panel and the existing delete confirmation (move tasks to "No version" or delete them too). Hover turns it red.
- Exports and backups must include archived versions.

## 6. Menus that survive the host

The board runs inside claude.ai in an iframe whose size changes as the mouse moves (toolbars appear and hide). A menu that closes on `resize` vanishes the moment the user reaches for its button.

```js
window.addEventListener('resize',placeVerMenu);           // reposition, do not close
function renderRelPanel(){var reopen=!!$('vb-menu');renderRelPanel0();
  if(reopen&&!$('vb-menu')){var pk=document.querySelector('#relpanel .vb-pick');if(pk)toggleVerMenu(pk,true)}}  // redraw keeps it open, without stealing focus
```

- Append floating menus to `body` with `position:fixed`; compute top/left from the trigger's rect; clamp to the viewport.
- Close on outside click and Escape; arrow keys move focus.
- Test it by dispatching `resize` while moving the mouse, and by firing a data snapshot while it is open (see testing.md, the iframe repro).

## 7. Project picker and form

- A button in the top line: `[icon] Project GC v`, same format as the dropdowns; the label word hides below 1440px.
- Menu: each project with icon, name, symbol and task count; "+ New project"; "Edit project".
- Form (modal dialog, Escape and backdrop close): name (used in the title), symbol (2-5 latin letters/digits, starts with a letter, forced to upper case, unique, locked after creation), optional image (resized to 96px), live preview of the generated icon.

## 8. Archive, restore, delete (general rule)

Any action that hides data needs a visible way back, and any action that removes data needs a confirmation that says what happens to dependent data. Archive is one click and reversible; delete is two steps.

## 9. Spacing method

1. Measure first (`measure_layout.js`): gaps between groups, leftover space, row line count, at 1280/1440/1600/1920.
2. Distribute leftover with capped spacers instead of `space-between`:
   ```css
   .tsp{flex:1 1 0;min-width:0;max-width:26px;height:1px;margin-inline:-5px}   /* with column-gap:10px => gap grows 10..36px */
   ```
   Place spacers with `order` between groups; keep logo and title glued.
3. Check the narrowest desktop width still fits on one line; add a smaller variant for 961-1340px rather than letting the row wrap.
4. Report before/after numbers per width.

## 10. Theme and background

- Light: page `#F3F4F1`, surfaces `#FFFFFF`, columns `#ECEEEA`, lines `#DCE1DB`, text `#1E2A25`, soft text `#56635D`.
- Dark: page `#121513`, surfaces `#1C211E`, columns `#171B19`, lines `#2E3732`, text `#E2E8E4`, soft text `#9AA8A1`.
- Optional faint geometric SVG tile (circles, rounded squares, triangles, plus, wave) at 8-13% stroke opacity, separate tints for dark mode, as `background-image` on the page and columns.
- Primary button text uses `var(--paper)` so it stays readable when the brand color turns light in dark mode (measured 9:1 light, 10.6:1 dark).
- Define tokens on `:root`, redefine under `prefers-color-scheme: dark` guarded by `:root:not([data-theme="light"])` and under `:root[data-theme="dark"]`.

## 11. RTL and Hebrew

- `dir="rtl"` on the page; use logical properties (`margin-inline-start`, `padding-inline`, `border-inline-start`) so the layout mirrors correctly.
- `position:absolute; left:8px` for a select's chevron is intentional in RTL (the chevron sits at the end of the text).
- Keys and symbols (`GC-17`, `APP`) get `dir="ltr"` inputs.
- Test with real Hebrew strings; Hebrew words are shorter in pixels than English but labels get longer.

## 12. Research sources used

- Nielsen Norman Group, icon usability (labels next to icons): https://www.nngroup.com/articles/icon-usability/
- Nielsen Norman Group, search box width (27 characters): https://www.nngroup.com/articles/magnifying-glass-icon/
- Baymard Institute, applied filters: https://baymard.com/blog/how-to-design-applied-filters
- Maersk design system, filter patterns: https://designsystem.maersk.com/guidelines/search-filter-and-sort/filter-patterns/
- Genesys Spark, table filtering (inline dropdowns for few filters): https://spark.genesys.com/latest/patterns/table-filtering/overview-QwBXFv4E
- PatternFly filter guidelines: https://v4-archive.patternfly.org/v4/design-guidelines/usage-and-behavior/filters
- Background colors: Atlassian elevation https://atlassian.design/foundations/elevation, Material dark theme https://m2.material.io/design/color/dark-theme
