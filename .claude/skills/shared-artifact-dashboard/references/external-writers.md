# Writing to a board's database from outside the page

**Definition of done for any external write:** the database has the change AND the page copy is republished from a fresh dump AND `check_copy_vs_db.py` reports a match. Writing alone is not done; a viewer whose live connection is not working sees only the page copy (this was missed three times).

Other Claude sessions (Claude Code in a terminal or IDE, another chat) may update the board directly with `ArtifactData` instead of through the page. That is fine and safe when these rules are followed. Each rule comes from a verified scenario (tests 46a-46f in the board suite).

## Rules

1. **Stamp the real time.** Set `updatedAt` (and the log entry's `at`) to the actual UTC time of the write, e.g. `date -u +%Y-%m-%dT%H:%M:%S.000Z` right before writing. Never a rounded or future time: a stamp of 16:20:00 on a write made at 16:14 makes any real edit a person saves in those six minutes look older, and the board drops it. A backdated stamp can be hidden in a tab that has a newer pending local edit of the same item (test 46d); with the real time the change shows (46e).
2. **Pin the write.** `get` the document first and pass its `version` as `if_version`. If someone changed it meanwhile, the write fails instead of overwriting them; re-read and redo.
3. **Change only the fields you mean to change** (`update`, not `set`). Never resend the whole document from an older read.
4. **Use the board's own values.** Enums come from the template (`TYPE`, `ST`, `SEV`, `OWN`, `PKG`, `SRC`, `RST`). Status values: `new` (To do), `approved`, `doing`, `fixed` (For review), `closed`, `wont`. Owners: `none`, plus the team keys in `OWN`.
5. **Log every change** in the same `batch`: a `log` doc with `at` (same real time), `who` (e.g. "Claude"), `by` (empty if you have no user id), `col:"items"`, `itemId`, `key` (e.g. `GC-5`), `project`, `title`, `action` (e.g. "עודכן"), and `details` in the board's format ("סטטוס: לטיפול ← לבדיקה").
6. **New items** need `project`, a `num` that is max+1 over the project's items AND the numbers mentioned in log keys (never reuse a number), `createdAt`/`updatedAt` real time, and valid enums.
7. **If the item needs someone's answer**, do not hide it only in `note`: the closed card shows no note, and the "waiting for answer" tab lists only `type:"request"` items. Assign it (`owner`) and move it to a status people look at (for example `fixed` / For review), or create a linked `request` item.
8. **Verify after writing**: `get` the doc again and check the fields; then run `scripts/validate_data.py <template> <dump>` on a fresh dump. Zero errors expected.

9. **Refresh the page copy.** After the write, republish the page from a fresh dump: `refresh_seed.py <live index.html> <dump> publish.html` (no template needed), publish with `url`, then check `check_copy_vs_db.py` reports a match. Full steps: SKILL.md "Updating tickets". If you cannot publish, say so explicitly. Without it, a viewer whose live connection fails keeps seeing the old state (this happened twice).

10. **Attaching screenshots or files.** Upload each file to the artifact's asset store (`Artifact publish` with `url`, `asset:true`, `file_path`); the result gives `/_blob/<32-hex id>`. Then `update` the item's `files` with the whole array: the existing entries plus `{id, name, type}` per new file (`id` = the 32-hex part, `type` = the MIME type such as `image/jpeg`; arrays replace wholesale, so never send only the new entries). Give screenshots a short descriptive `name` (it is shown under the preview). Then rule 9.

## What does not need doing

- Open tabs with a working connection receive the change within seconds (test 46a), and an external write never triggers a republish loop (46f). The republish in rule 9 is for viewers whose connection is not working.
- Older unsynced local copies in users' browsers lose to a newer external write and are cleared automatically (46c).

## Hand-off text for another session

Give this to any session that will write to the board (it may not have this skill):

> Board writes: (1) `updatedAt` and log `at` = the real UTC time from `date -u` right before the write, never rounded or in the future; (2) pin with `if_version`, `update` only changed fields, log entry in the same batch; (3) for files, upload as assets and append `{id, name, type}` to the existing `files` array; (4) a write is not finished until the board page is republished from a fresh dump (`refresh_seed.py` on the live `index.html`, then publish with `url`) and `check_copy_vs_db.py` matches. If you cannot republish, say so explicitly in your final message ("the board page was NOT republished - ask the board session to republish") instead of reporting the tickets as visible.
