# Compact shell — the phone UI

How Swifty's iOS layout is built, and the rules every change to it follows. The
design reference is the "Keyring Mobile Prototype" (an iPhone mock: large-title
tab roots, a floating tab bar, a detail screen pushed from the right with a
bottom primary action, a bottom-sheet kind picker, a slide-up form, a
biometric-first lock screen). The prototype is a guideline for *layout and
motion only*. Brand, labels, i18n strings, kinds and features come from the
desktop app, which stays the source of truth.

## Status

| Slice | Scope | State |
|---|---|---|
| 1 | Foundations: `Frame` context, layout branches lifted out of leaves, glass token, rise keyframe, touch-visible copy buttons | ✅ |
| 2 | Compact shell as screens: derived screen selection, floating tab bar, large-title list root, top bar removed | ✅ |
| 3 | Detail read screen: nav row, kind header, container-query row geometry, tap-to-copy rows, bottom primary action | ✅ |
| 4 | Form screen: `Edit` split into `Title` + `Body`, slide-up form with Save/Cancel in the nav row, add picker as a bottom sheet | ✅ |
| 5 | Generator and Settings as tab roots; Archive reachable from Settings | ✅ |
| 6 | Lock screen: `useUnlock` hook, biometric-first compact layout, platform-correct biometric label | ❌ |

## The three rules

Platform differences are handled by exactly one of these, chosen by what kind
of difference it is. Nothing else branches on layout.

1. **Screen structure is composition, decided once in the shell.**
   `Main/index.tsx` is the only component that calls `useLayout()`. `Wide` and
   `Compact` each assemble their screens from shared content components. Leaf
   components never ask which shell they are in. Where a leaf must be framed
   differently (a dialog card on desktop, a sheet on a phone) it renders the
   `Frame` from `elements/Frame`, and the shell provides the implementation
   through context.
2. **Row and element geometry adapts with CSS container queries, not JS.**
   `FieldRow`, `Field`, the detail header and `Footer` stack label-over-value
   when their container is narrow. Tailwind v4's `@container` / `@max-*`
   variants do this with zero render branches, and every kind inherits it.
   The threshold is 420px and the container is whichever surface declares
   itself one — `Show/Read` and `Show/Edit` on the desktop, the detail
   scroller on the phone.
3. **Capability differences use compile-time constants and media features.**
   `isMobile` / `isIOS` from `lib/platform` (Face ID vs Touch ID, no updater,
   no drag-and-drop). Hover-only affordances become visible under
   `@media (hover: none)`. Both are constants or CSS, never `useLayout`.

Corollaries: no `compact` boolean props on shared components (a slot such as
`actions` is composition and is fine); no new navigation state when the store
already implies the screen; no new dependency for animation or routing.

A dialog that needs a different frame on a phone says so by describing its own
content, never the platform: `FrameProps.fit` is `'screen'` (the default — a
settings surface, the generator) or `'content'` (a short one, the add picker).
`Modal` always has the room and ignores it; `Sheet` reads it to choose between
a full-screen page and `elements/BottomSheet`. Sizes travel the same way —
`className`, `tile`, `glyph` — so `Show/Edit/Title` draws a 28px tile in the
pane and a 44px one on the phone without being told which it is.

## Navigation model

There is no router. The compact shell derives its screen from state the store
already has:

| State | Screen |
|---|---|
| `entries.new !== null` or `entries.edit` | Form (slide-up) |
| `entries.current !== null` | Detail (pushed from the right) |
| `ui.settings` | Settings tab root (a section pushes its pane) |
| `generator.open` with no `apply`/`ssh` callback | Generator tab root |
| otherwise | List root for `ui.view` |

The one exception is which settings pane is open: that is `useState` inside
`Compact/Settings`, because `ui.settingsSection` is the *wide* modal's nav
selection and persists, so a phone reading it would open Settings already
inside a pane. It is one level deep and resets with the screen.

Every row is its own screen: the detail as of slice 3 (`Compact/Detail/Read` —
nav row, kind header, bottom primary action), the form as of slice 4
(`Compact/Form` — Cancel/Save in the nav row over one `@container` scroller),
and as of slice 5 the two remaining roots. The generator splits by *how it was
opened*, not by shell: standalone it is `Compact/Generator` (large title, mode
switch, `Generator/Panel`, a bottom Use & copy), and opened from a password row
it is `Generator/Attached` — the same `Dialog` the wide shell mounts, framed as
a page sheet. Both take `useGeneratorDialog`, so the two shells generate the
same way. Settings is a root list of rows over the desktop's own `Section`
panes, and carries the lock control the vanished top bar used to.

Both screens compose parts the desktop's `Aside/Show` also composes —
`Identity`, `Eyebrow`, `Edit/Title`, `Edit/Body`, `Footer`, `MoreMenu`, and the
`useDraft` / `usePrimaryAction` / `useShown` / `useDelete` hooks. Neither shell
passes the other a layout flag; each only decides where the parts go. The form
holds its frame behind `useShown().held` exactly as `Show` does: an editor
seeded from a reveal that has not landed would discard whatever is typed first.

Overlays that stay overlays on a phone: the add picker (`fit="content"`, so a
bottom sheet) and the generator opened from a password row (a page sheet). Both
go through `Frame`.

Tabs (labels are the desktop's i18n keys): **All Items · Favorites · Generator
· Settings**. Archive is a row in Settings on compact. A list tab closes
settings and the standalone generator and calls `setView`; Generator and
Settings are one screen slot between them, so each closes the other.

Transitions are mount animations only (`animate-sheet` slides in from the
right, `animate-rise` slides up, `animate-fade` for roots). No exit animations.

## iOS conventions to follow

- Touch targets ≥ 44×44pt. Rows ≥ 44pt tall; list rows in the design are 64pt.
- Safe areas: `env(safe-area-inset-top/bottom)` on anything touching an edge.
- Large title on tab roots (mono eyebrow above, 32px semibold title), no top
  bar. Pushed screens get a nav row: a back control that carries the previous
  screen's title, trailing text/icon actions.
- Tab bar: floating pill, glass surface (`bg-glass` + `backdrop-blur`), icon
  over a 10px label, selected tab in accent on an accent-soft wash. Content
  scrolls underneath (the scroller reserves bottom padding).
- Bottom sheets carry a grabber and dismiss on scrim tap; full-screen forms
  put Cancel on the left and Save on the right of the nav row.
- The primary action of a detail screen is a bottom, thumb-reachable button.
- Copy on tap for value rows; the feedback is the existing copy toast.
- No hover-only UI. No tooltips as the sole label.
- Keyboard: anything full-screen with inputs is sized from
  `useVisualViewport` (`viewportStyle`), like `Sheet` already is.
- Respect `prefers-reduced-motion` (already global in `theme.css`).
- Use system type (`--font-sans` is SF on Apple platforms). Don't add webfonts.

## Theming

Light and dark are both first-class. Only the `--c-*` tokens in
`styles/theme.css` (exposed as `bg-app`, `text-text2`, `border-line`,
`bg-accent-soft`, …) may be used for colour. No hex literals or
`dark:` variants in components: a new surface is a new token defined in both
palettes. Prototype-only colours map to existing tokens (`--list` → `bg-list`,
`--card` → `bg-card`, `--tile` → `bg-tile`, `--field` → `bg-field`,
`--glass` → new `bg-glass`).

## Testing

- `bun run typecheck`, `bun run lint` (0 warnings), `bun run test` must stay
  green. The e2e suite runs the wide shell and must be untouched by compact work.
- Compact behaviour is covered in `src/test/compact.test.tsx` through
  `setLayout('compact')`; each new screen adds cases there.
- Existing `data-testid`s are preserved. New compact controls get their own.
- The wide shell renders identically after each slice.

## Product decisions taken

- Search stays the inline field that filters the list live (no separate search
  screen). Styled at 44pt.
- A read row's value is itself the copy affordance, on both shells. Text
  selection is off app-wide (`select-none`), so a press on it has no other
  meaning, and the desktop keeps its copy button beside it.
- The list stays flat and sorted (no Pinned/Recent groups).
- Unlock leads with the biometric tile when biometrics are enrolled, else the
  passphrase card. No auto-prompt on launch.
- Not adopted from the prototype: share button, recent searches, vault
  switcher, card face art. The Swifty mascot stays on the lock screen.
