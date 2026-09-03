export const CARD = 'overflow-hidden rounded-lg border border-line bg-[image:var(--card)]'

export const ROW_HAIRLINE = 'shadow-[inset_0_-1px_0_var(--c-line)] last:shadow-none'

// App-level transient feedback (the update prompt, the scan status): a floating
// panel on the detail surface. Each toast places itself — two of them in the
// same corner would sit on top of each other.
export const TOAST =
  'animate-pop fixed z-[1000] max-w-[340px] rounded-xl border border-line bg-detail text-text shadow-[var(--shadow)]'

// The mono micro-label face, without an ink. Take this when the label needs a
// different colour (the accent "EDITING ·" eyebrow) and MONO_LABEL otherwise.
export const MONO_TYPE = 'font-mono text-xs uppercase tracking-label'

export const MONO_LABEL = `${MONO_TYPE} text-text3`
