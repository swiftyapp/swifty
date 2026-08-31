# Swifty v1 — Next Work Checklist

The post-remediation work batch for `v1-0-0`. The audit-remediation checklist
([`v1-remediation.md`](./v1-remediation.md)) is **complete** — this is where the next
three initiatives are tracked.

Same working conventions as the remediation doc: each task is a self-contained unit with
scope, concrete steps, and an acceptance gate a subagent can verify; standing code style is
the simplest thing that works, DRY, short implementations; definition of done includes the
repo gates staying green (`bun run typecheck` · `bun run lint` 0 warnings · `bun run test` ·
`cargo test` · `cargo clippy -D warnings`). Zoom out before building — look at how leading
products solve it, don't patch symptoms.

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Done |
| 🟡 | In progress / partial |
| ❌ | Not started |

---

## 1. GDrive sync ❌ 🔴 OWNER-REVIEW

Re-enable Google Drive sync on the new SQLite storage engine. Postponed during remediation;
picking it back up now. **The storage groundwork already exists** — do not rebuild it:
`entries` carry `updated_at` / `deleted_at` (LWW + tombstones), and `SqliteStore::export_for_sync`
already yields all records including tombstones. This is the sync *algorithm + Drive transport*,
not a storage change.

**Scope:**
- **Per-row last-writer-wins merge with tombstones** (replaces the legacy whole-vault merge).
  Reconcile local vs remote record sets by `id`, resolving each by the newer `updated_at`;
  a tombstone (`deleted_at` set) wins over an older live edit. Deterministic, no whole-file overwrite.
- **Deterministic Drive-folder handling** — stable app folder discovery/creation, no duplicate
  folders on repeated setup; handle the "folder deleted remotely" case.
- **Token handling** — the Drive OAuth token blob is already encrypted with the session key
  (`VaultKey::cryptor()`); wire the actual sync push/pull around it.

**Prereqs / owner input needed:** a Google OAuth client ID for the app (release gate — not an
agent task). Confirm the encrypted-payload sync unit (do we sync the opaque per-entry AEAD
payloads as-is, re-keyed by the recipient, or a portable envelope?) before building — this is
the 🔴 review point.

**Acceptance:** two installs sharing a vault converge (add/edit/delete on each side reconciles
correctly); a delete on one device propagates as a tombstone, not a resurrection; repeated
setup never creates duplicate Drive folders; sync round-trip covered by tests.

_(Legacy audit refs: T-SYNC-1 / T-SYNC-2, D2–D4, S13.)_

---

## 2. Frontend redesign ❌

A visual/UX refresh of the app. Tailwind was considered and deferred during the dependency
modernization — revisit as part of this. The React stack is current (React 19 + zustand +
Vite + bun); this is design/UX, not a framework migration.

**To define before building** (owner input — this is a product/design decision, not purely
technical):
- Design direction / reference — what does "redesigned" look like? (mockups, a reference app,
  or a described aesthetic).
- Tailwind adoption: yes/no. If yes, introduce it alongside the existing styles and migrate
  incrementally (component-by-component), not a big-bang rewrite.
- Scope: full re-skin vs. targeted screens (unlock, entry list, entry detail, settings).

**Constraints to preserve:** the `data-testid` selectors the E2E suite relies on (don't break
`tests/e2e/`); split complex components into folders with an `index.tsx` + logical subcomponents
per the standing React convention; keep theme/accessibility intact.

**Acceptance:** TBD once direction is set — at minimum, E2E smoke suite still green, no
regressions in the core flows.

---

## 3. E2E specs port from legacy ❌

Port the legacy Electron E2E coverage onto the new `tauri-plugin-webdriver` harness landed in
the remediation phase (`tests/e2e/`, mirrors the reticle app; one smoke spec today). The legacy
app had **18 feature specs** under `test/features/` (on `master`) driven by **Spectron** —
Spectron itself is dead (Electron-only, archived 2022), but it was built on WebdriverIO, so the
spec *logic* ports nearly 1:1 (`app.client.$` → global `$`; `setValue`/`click`/`getText` identical).

**Legacy specs to port** (prioritized by value):
- **High:** setup validation (`setup/password`), login CRUD (`logins/create|edit|delete`),
  search (`logins/search`), audit (`audit`), change-password (`settings/change_password`).
- **Medium:** cards (`cards/create`), notes (`notes/create`), vault settings (`settings/vault`).
- **Low / thin:** empty states (`logins/empty`, `tags/empty`), tags filter (`tags/filter`),
  launch scope.

**Porting notes:**
- Map class selectors (`.body .list`) to `data-testid` where the redesign (item 2) will churn
  class names — coordinate ordering with the frontend redesign so specs aren't ported twice.
- `before({storage: 'empty'|'pristine'})` → the new `SWIFTY_DB_DIR` temp-dir isolation
  (`pristine` = no vault → Setup; `empty` = vault, no entries).
- **Drop/adjust stale assertions** from the rebrand + disabled sync — e.g. `setup/password`
  asserts old welcome copy mentioning "Import from Gdrive"; several assert sync UI that's off.
- Batch the port (an agent per group), high-value flows first.

**Acceptance:** the ported specs pass in CI (the `e2e` job); each covers the flow its legacy
counterpart did, minus sync assertions until item 1 lands.

**Sequencing note:** ideally after (or interleaved with) the frontend redesign (item 2), so
selectors are ported against the final UI, not the current one.

_(Legacy audit ref: T-CI-2 extended — the smoke spec is done; this is the breadth.)_

---

## Suggested order

Sync (1) is independent and can proceed now. The redesign (2) and the E2E port (3) are
coupled — do the redesign first (or alongside) so specs are written against the final UI,
avoiding a double port.
