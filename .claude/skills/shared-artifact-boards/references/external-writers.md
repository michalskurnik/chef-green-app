# Writing to a board's database from outside the page

Other Claude sessions (Claude Code in a terminal or IDE, another chat) may update the board directly with `ArtifactData` instead of through the page. That is fine and safe when these rules are followed. Each rule comes from a verified scenario (tests 46a-46f in the board suite).

## Rules

1. **Stamp the real time.** Set `updatedAt` (and the log entry's `at`) to the actual UTC time of the write, e.g. `date -u +%Y-%m-%dT%H:%M:%S.000Z` right before writing. A backdated stamp can be hidden in a tab that has a newer pending local edit of the same item (test 46d); with the real time the change shows (46e).
2. **Pin the write.** `get` the document first and pass its `version` as `if_version`. If someone changed it meanwhile, the write fails instead of overwriting them; re-read and redo.
3. **Change only the fields you mean to change** (`update`, not `set`). Never resend the whole document from an older read.
4. **Use the board's own values.** Enums come from the template (`TYPE`, `ST`, `SEV`, `OWN`, `PKG`, `SRC`, `RST`). Status values: `new` (To do), `approved`, `doing`, `fixed` (For review), `closed`, `wont`. Owners: `none`, plus the team keys in `OWN`.
5. **Log every change** in the same `batch`: a `log` doc with `at` (same real time), `who` (e.g. "Claude"), `by` (empty if you have no user id), `col:"items"`, `itemId`, `key` (e.g. `GC-5`), `project`, `title`, `action` (e.g. "עודכן"), and `details` in the board's format ("סטטוס: לטיפול ← לבדיקה").
6. **New items** need `project`, a `num` that is max+1 over the project's items AND the numbers mentioned in log keys (never reuse a number), `createdAt`/`updatedAt` real time, and valid enums.
7. **If the item needs someone's answer**, do not hide it only in `note`: the closed card shows no note, and the "waiting for answer" tab lists only `type:"request"` items. Assign it (`owner`) and move it to a status people look at (for example `fixed` / For review), or create a linked `request` item.
8. **Verify after writing**: `get` the doc again and check the fields; then run `scripts/validate_data.py <template> <dump>` on a fresh dump. Zero errors expected.

## What does not need doing

- No republish is needed: open tabs receive the change live within seconds (test 46a), and an external write never triggers a republish loop (46f). The page copy catches up on the next edit made through the page.
- Older unsynced local copies in users' browsers lose to a newer external write and are cleared automatically (46c).
