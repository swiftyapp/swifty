// Class strings for the three surface conventions shared by more than one
// element: the card surface, the row hairline that separates stacked rows
// inside it, and the mono uppercase label tier. Kept here (not in a screen
// module) so `elements/` never has to reach upward for them.

// A bordered card on the gradient `--card` background. `overflow-hidden` is
// part of the surface: rows clipped by the radius are what make the hairlines
// stop cleanly at the corners.
export const CARD = 'overflow-hidden rounded-lg border border-line bg-[image:var(--card)]'

// Bottom hairline for a row in a stack; the last row drops it so the card edge
// is the only line.
export const ROW_HAIRLINE = 'shadow-[inset_0_-1px_0_var(--c-line)] last:shadow-none'

// Mono uppercase micro label (group headings, field labels, meta).
export const MONO_LABEL = 'font-mono text-xs uppercase tracking-label text-text3'
