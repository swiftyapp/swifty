export const CARD = 'overflow-hidden rounded-lg border border-line bg-card'

export const ROW_HAIRLINE = 'inset-shadow-hairline last:inset-shadow-none'

// A 460px face (a credit card, an ID document) with its note panel: stacked,
// and side by side once the *pane* is wide enough for both — 460 plus a note
// column worth reading. A container breakpoint rather than a viewport one:
// the detail pane can be far narrower than the window (a split view, an iPad
// half), and the faces themselves fold by container width, so the two must
// agree on what "wide" means.
export const FACE_ASIDE =
  'grid grid-cols-1 items-start gap-3 @min-[720px]:grid-cols-[460px_minmax(0,1fr)]'

// A trailing control that stays out of the way until the row is asked about —
// hovered, or holding the keyboard. Pairs with a `group` on the row itself.
// Opacity only: the control keeps its place in the layout and in the tab order.
// A finger cannot hover, so on touch the control is simply always there.
// `any-pointer-coarse`, not `pointer-coarse`: the latter only matches when the
// *primary* pointer is coarse, which leaves an iPad with a trackpad or a touch
// laptop hiding the control from the finger that is also on the device.
export const HOVER_ONLY =
  'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 any-pointer-coarse:opacity-100'

// App-level transient feedback (the update prompt, the scan status): a floating
// panel on the detail surface. Each toast places itself — two of them in the
// same corner would sit on top of each other.
export const TOAST =
  'animate-pop fixed z-[1000] max-w-[340px] rounded-xl border border-line bg-detail text-text shadow-float'

// The micro-label face, without an ink: 11px, uppercase, tracked, regular
// weight — a label is the secondary line, and the value it captions carries the
// weight. Take this when the label needs a different colour (the accent
// "EDITING ·" eyebrow) and LABEL otherwise.
export const LABEL_TYPE = 'text-xs uppercase tracking-label'

export const LABEL = `${LABEL_TYPE} text-text3`

// The meta face, without an ink: counts, timestamps, hints, shortcuts, chips —
// the same 11px as the label tier, set as ordinary text rather than a tracked
// uppercase eyebrow. Tabular figures, so a count or a countdown holds its width
// as it changes instead of nudging what sits beside it. Take this when the ink
// is the caller's (a count inheriting its chip's colour, an error in `text-bad`)
// and META otherwise.
export const META_TYPE = 'text-xs tabular-nums'

export const META = `${META_TYPE} text-text3`

// The detail row's value line: one line high, never wrapping, the ink the
// caller's. VALUE_LINE leaves the size open for the one row that sets its own
// (the headline secret, at text-xl); everything else takes VALUE.
export const VALUE_LINE = 'block h-6 min-w-0 truncate leading-6'

export const VALUE = `${VALUE_LINE} text-base`

// What a masked secret is read as. Fixed, so the mask says nothing about the
// secret's length: twelve dots for a value line, twenty-four for a block.
export const MASK_DOTS = '•'.repeat(12)
export const BLOCK_DOTS = '•'.repeat(24)
