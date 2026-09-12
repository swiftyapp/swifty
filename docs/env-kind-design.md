# Env files as a kind — UI design

Status: proposal, no code yet.

A `.env` file is the container; each variable inside it is a value you can read,
copy and change on its own. This document designs that as a sixth `Kind`,
sitting next to logins, cards, notes, identities and SSH keys, and reuses the
detail-row grammar the other kinds already share.

## 1. What the user is trying to do

- Keep the `.env` files for a project somewhere safer than a Slack DM or a
  `~/Desktop/env-backup` folder.
- Grab one variable (`STRIPE_SECRET_KEY`) without opening the file.
- Rotate one variable without re-uploading the whole file.
- Get the file back out, byte-identical, when setting up a new machine.

Three jobs follow from that: **ingest** a file with no ceremony, **read** it as
a table, **edit** one row or the whole file, and hand the file back **out**.

## 2. Model: the file is canonical, the table is a view

One secret field holds the file text. Rows are parsed from it at render time.
Editing a row rewrites just that line in the text.

```
EnvEntry {
  type: 'env'
  title: string          // "api · production"
  fileName: string       // ".env.production" — non-secret, goes to EntryMeta
  body: string           // the file, verbatim
  note: string
}
EntryMeta += fileName?: string, varCount?: number   // stamped at save, like cardBrand
```

Why not store an array of rows:

- Comments, blank lines, `export` prefixes, quoting style and `${VAR}`
  references all round-trip untouched. "Save as .env" gives back exactly what
  was dropped in.
- The raw-text editor and the table editor write to the same string, so there
  is no sync problem between two faces of the entry.
- It is one field. The kind is roughly as complex as `ssh`, not a new subsystem.

The parser must be tolerant: a line it cannot read is kept verbatim and shown
only in the File tab. Nothing is ever dropped on save.

Round-trip rules for a row edit:

- Value changed → replace the value span on that line, keeping the line's
  quote style; switch to double quotes only when the new value needs them
  (spaces, `#`, newlines, leading/trailing whitespace).
- Key changed → replace the key span, keep everything else on the line.
- Row removed → the line is removed. A comment that captioned only that line
  stays; the user sees it in the File tab and can remove it there.
- Row added → appended at the end of the file, or at the end of the band the
  user pressed "Add variable" in.

## 3. Where it lives

**Rail / Add picker.** A sixth tile: glyph is a dotted-page mark (a page with
`{ }` or `.env` on it), tint `env` via a new `--color-kind-env` token (a leaf
green, distinct from the five present tints). Labels:

| key | copy |
| --- | --- |
| label | Env file |
| pluralLabel | Env files |
| description | .env files & variables |
| addLabel | Add an env file |
| emptyLabel | No env files yet |
| primaryActionLabel | Copy .env |

**List row.** Glyph tile, title, subtitle from non-secret metadata only:
`.env.production · 14 vars`. The count is stamped at save time the way the card
brand is; the body stays encrypted.

**Detail header.** Eyebrow reads `ENV FILE · .env.production` once the entry
is revealed (the `Kind.eyebrow` hook). Primary button is **Copy .env**, which is
what `⏎` and `⌘⏎` copy. The `⋯` menu gains **Save as file…**.

## 4. Read view

```
ENV FILE · .env.production                        ☆  Edit  ⋯  [ Copy .env ⏎ ]
api · production

┌ Variables ─ File ┐                                          14 variables  👁
┌────────────────────────────────────────────────────────────────────────────┐
│ # Database                                                                 │
│ DATABASE_URL          ••••••••••••                                  👁  ⧉  │
│ DB_POOL_SIZE          ••••••••••••                                  👁  ⧉  │
├── (gutter) ────────────────────────────────────────────────────────────────┤
│ # Stripe                                                                   │
│ STRIPE_SECRET_KEY     ••••••••••••                                  👁  ⧉  │
│ STRIPE_WEBHOOK_SECRET ••••••••••••                                  👁  ⧉  │
├────────────────────────────────────────────────────────────────────────────┤
│ NODE_ENV              ••••••••••••                                  👁  ⧉  │
│ PORT                  ••••••••••••                                  👁  ⧉  │
└────────────────────────────────────────────────────────────────────────────┘
Note (when present)
MODIFIED 9M · CREATED 30.10.2023
```

**Two faces, one segmented control.** `Variables` (default) and `File`. The
segmented control is the existing `Segmented` element. The count and a single
"reveal all" eye sit on the same line, right-aligned, mirroring the card face's
one eye.

**Filter.** A real `.env` file runs to forty or sixty variables, and the list
search only sees titles and tags. So once a file has more than six variables a
filter box sits above the table, in both modes, styled like the list search.
It matches the key and the band caption, case-insensitively, and never the
value: values are masked, and a filter that matched them would let anyone
narrow a secret down by typing prefixes at it. Bands with no matching rows
fold away; nothing matching shows a muted "No variables match" line. Escape
clears it. Filter state lives in the component and resets with the entry.

**Rows.** Same row geometry as every other kind's detail rows: hairline
between rows, hover reveals the copy button, the value itself is a
click-to-copy target, per-row eye reveals one value. Differences from
`FieldRow`:

- The key column is sized to the longest key in the file, clamped between 128px
  and 40% of the panel, instead of the fixed 128px label column. Env keys are
  often 25–30 characters.
- Key and value are set in the code face (the same treatment the SSH private key
  keeps after the monospace purge) because they are literally code. Everything
  around them stays on the UI type.
- Key is not uppercased or restyled. It is the user's identifier; show it as
  written.

**Bands from comments.** A comment line that precedes a run of variables becomes
that band's caption in the label face (`# Database` → `DATABASE`). Blank lines
become the 8px gutter the identity kind already cuts through its panel. The
result is that a well-kept `.env` file lays itself out with zero effort from
the user. Trailing inline comments (`PORT=3000 # dev only`) render as the
muted gloss after the value, like the country gloss on identities.

**Masking.** Every value is masked by default. The fixed twelve-dot mask says
nothing about length. Two ways out: the row's eye, and the panel's reveal-all
eye. Reveal state is per session and never saved.

Why not guess which variables are secrets from their names: a `PORT` shown in
plain is convenient, but a wrong guess (`DB_HOST=user:pass@…`) shows a secret
on a shared screen. Guessing is a v2 experiment with an explicit per-row
"plain" flag, not a v1 default.

**File tab.** The raw text, masked as one block until revealed, with copy and
reveal in the rail. This is the SSH private-key block, taller. Long files scroll
inside a capped well rather than pushing the metadata line off screen.

## 5. Edit view

```
EDITING · ENV FILE
[ api · production                         ]      Cancel   [ Save ⌘⏎ ]

┌ Variables ─ File ┐
┌────────────────────────────────────────────────────────────────────────────┐
│ DATABASE                                                                   │
│ [DATABASE_URL        ] [postgres://…                              ]   ×    │
│ [DB_POOL_SIZE        ] [10                                        ]   ×    │
│                                                        + Add variable      │
├────────────────────────────────────────────────────────────────────────────┤
│ STRIPE                                                                     │
│ [STRIPE_SECRET_KEY   ] [sk_live_…                                 ]   ×    │
│ [STRIPE_WEBHOOK_SECRT] [whsec_…                                   ]   ×    │
│   ↳ Duplicate key                                                          │
│                                                        + Add variable      │
└────────────────────────────────────────────────────────────────────────────┘
┌ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ┐
│  ⤓  Drop a .env file here, or paste KEY=VALUE lines into any row           │
└ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ┘
Note
```

**Rows are inputs.** Each row is a key box and a value box on the same
underlined-input style every other editor uses, with a remove `×` at the rail.
This is the `CustomFields` editor with a wider first column and code-face type.
Values start revealed while editing, as every secure field does. A value that
contains a newline grows its box like the note editor does.

**Add variable** appears at the end of each band and once at the bottom when
there are no bands. New rows go into the band they were added from.

**Validation, shown inline under the row in the error ink:**

- Key empty → `Required` (blocks save).
- Key not `[A-Za-z_][A-Za-z0-9_]*` → `Not a valid name` (blocks save).
- Duplicate key → `Duplicate key` (warns; dotenv tolerates it, last wins, and
  a dropped file may legitimately contain one).

**Bulk paste.** Pasting text that contains a newline and at least one
`KEY=VALUE` line into any key box parses it into rows at that position instead
of stuffing it into the box. This is the primary ingest path on a phone and a
very common desktop path (copying a block from a chat).

**File tab while editing** is a plain textarea over the same string. Switching
tabs re-parses. Power users fix quoting or comments here; the table is never
out of date because there is only one source.

**Drop zone.** A dashed target at the foot of the editor, same treatment as
the import drop zone, wired to the webview drag-drop event. Dropping a file:

- On a new, empty draft → fills the body, sets `fileName`, and proposes a
  title from the path (`<parent folder> · <env name>`, e.g. `api · production`
  from `~/code/api/.env.production`). The title stays editable.
- On a draft that already has content → a two-button inline prompt:
  **Replace** or **Merge new keys**. Merge appends keys not already present and
  leaves existing rows alone, so a teammate's newer file can top up yours
  without clobbering rotated values.

On mobile the zone is a button that opens the file picker, exactly as the
import drop zone already does.

## 6. Ingest without opening the editor first

Dropping a file onto the app window while nothing is being edited:

- If the file name matches `.env*` or `*.env`, or the content parses as env
  (one or more `KEY=VALUE` lines, not JSON, not CSV) → open the env editor as
  a new draft with the body filled and the title proposed. One drop, one save.
- Otherwise → nothing happens outside the import screen, as today.

The Add picker also gets a link under the tiles, next to the scan action:
**Drop a .env file** on desktop, **Choose a .env file** on mobile.

## 7. Compact shell

Below the 420px container fold, rows stack the way `FieldRow` already does:
key on its own line in the label face, value below it, rail controls grow to
the 44px touch target. Values wrap with `break-all` rather than truncating,
because a truncated token is useless and there is no hover to reveal a copy
button. The value stays the tap-to-copy target. The segmented control keeps its
two segments side by side; the count and eye drop under it.

## 8. Edge cases the parser and editor must hold

| case | behaviour |
| --- | --- |
| `export KEY=value` | prefix preserved; row shows `KEY` |
| `KEY="multi\nline"` and real multi-line quoted values | one row, box grows |
| `KEY=${OTHER}` | shown literally, never expanded |
| `KEY=` (empty) | row shown, value blank, copy copies empty string |
| Line with no `=` | kept verbatim, visible only in File tab |
| CRLF, BOM, trailing newline | preserved byte-for-byte |
| Duplicate keys | both rows shown, warning on the later one |
| Very long file (200+ rows) | table virtualisation is not needed; the File tab well caps height and scrolls |

## 9. Deliberately left for later

- **Per-row "plain" flag** so `PORT` and `NODE_ENV` can stay unmasked, plus a
  name-based suggestion for it.
- **Compare two env entries** side by side (dev vs prod) with missing keys
  highlighted. This is the "collection of env files" story done properly; v1
  handles the collection with one entry per file plus tags.
- **Drag to reorder rows.** Order is file order; the File tab reorders today.
- **Audit integration**: flag env values that reuse a login password.

## 10. What this touches

New:

- `src/kinds/env/` — `index.tsx`, `meta.ts`, `ListRow.tsx`, `Fields/` (Table,
  Row, Band, FileTab, DropTarget), `parse.ts` (+ tests).
- `EntryType` and `Kind['tint']` gain `'env'`; `EnvEntry` in `commands.ts`;
  `--color-kind-env(-soft)` tokens; the env glyph.
- Rust `Entry` gains `body` and `file_name`; `EntryMeta` gains `file_name` and
  `var_count`, stamped at save.
- i18n keys for the labels above.

Reused as-is: `Panel`, `Segmented`, `FieldRow`'s tokens and fold rules,
`CopyButton`, `IconButton`, `HOVER_ONLY`, `ROW_HAIRLINE`, the `CustomFields`
editor pattern, the SSH private-key block, the import `DropZone` wiring, the
`Kind.eyebrow` hook, the header's primary-action plumbing.

## 11. Suggested PR slicing

1. **Kind + parser + read/edit table + filter + File tab.** Model changes,
   parser with round-trip tests, the two faces, the filter, validation. Usable
   end to end by pasting a file into the File tab. Acceptance: drop-in text
   round-trips byte-identical after editing one value; every row copies its
   true value; masks are fixed width; the filter never matches a value; the
   compact fold works.
2. **Ingest.** Editor drop zone with replace/merge, bulk paste into rows,
   window-level drop when idle, Add-picker link, mobile picker. Acceptance: one
   drop from Finder produces a saved entry in two clicks.
3. **Polish.** List-row `fileName · N vars` metadata, eyebrow, `Save as file…`
   in the `⋯` menu, inline-comment gloss, band captions from comments.

Each PR is independently shippable; 2 and 3 do not depend on each other.
