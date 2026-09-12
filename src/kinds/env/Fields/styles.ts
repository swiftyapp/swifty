import type { CSSProperties } from 'react'

/*
 * What the env rows have that the detail rows beside them do not. The fold
 * rules and the rail come from `fields/Row.tsx`; the mask and grow helper from
 * `elements/tokens` and `fields/grow`. Only the table's own geometry is here.
 */

// Stacked, a value wraps rather than truncates: a cut token is useless, and
// there is no hover to find the copy button with.
export const STACK_VALUE = '@max-[420px]:h-auto @max-[420px]:whitespace-normal @max-[420px]:break-all'

// The underlined editor box CustomFields draws, minus its border ink — the row
// picks that by whether it has something to complain about.
export const BOX = 'border-b bg-transparent outline-none transition-colors placeholder:text-text3'
export const BOX_LINE = 'border-line2 focus:border-accent-line'

// The key column. Its width is one value per table (`--key-col`, set on the
// panel), read here so the `ch` inside it resolves in the mono face the key
// is actually set in. Key and value are code, so they keep the code face the
// SSH private key kept after the monospace purge.
export const KEY_COL = 'w-(--key-col) flex-none font-mono text-base'

// Sized to the longest key, clamped between the fixed label column and 40% of
// the panel: env keys run to thirty characters and a fixed 128px would fold
// most of them.
export const keyColumn = (vars: { key: string }[]): CSSProperties => {
  // A loop, not a spread into Math.max: a pasted file of tens of thousands of
  // lines would otherwise blow the engine's argument limit mid-render.
  let longest = 0
  for (const v of vars) if (v.key.length > longest) longest = v.key.length
  return { '--key-col': `clamp(128px, ${longest}ch, 40%)` } as CSSProperties
}

// Focus with the caret at the end, for a box that took over typing mid-word.
export const focusEnd = (el: HTMLInputElement | null) => {
  if (!el) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
}
