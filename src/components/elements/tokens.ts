export const CARD = 'overflow-hidden rounded-lg border border-line bg-card'

export const ROW_HAIRLINE = 'inset-shadow-hairline last:inset-shadow-none'

// A trailing control that stays out of the way until the row is asked about —
// hovered, or holding the keyboard. Pairs with a `group` on the row itself.
// Opacity only: the control keeps its place in the layout and in the tab order.
export const HOVER_ONLY =
  'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'

// App-level transient feedback (the update prompt, the scan status): a floating
// panel on the detail surface. Each toast places itself — two of them in the
// same corner would sit on top of each other.
export const TOAST =
  'animate-pop fixed z-[1000] max-w-[340px] rounded-xl border border-line bg-detail text-text shadow-float'

// The mono micro-label face, without an ink. Take this when the label needs a
// different colour (the accent "EDITING ·" eyebrow) and MONO_LABEL otherwise.
export const MONO_TYPE = 'font-mono text-xs uppercase tracking-label'

export const MONO_LABEL = `${MONO_TYPE} text-text3`

// The mono meta face: counts, timestamps, hints, shortcuts — the same 11px mono
// as the label tier, muted, but set as ordinary text rather than a tracked
// uppercase eyebrow.
export const MONO_META = 'font-mono text-xs text-text3'
