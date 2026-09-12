import type { CSSProperties } from 'react'

/*
 * What the env rows share with the detail rows they sit beside.
 *
 * `FieldRow` and `CustomFieldRow` keep their fold rules, box style and grow
 * helper module-private, and those files are not this kind's to widen. So the
 * literals are repeated here, verbatim, with the one rule that matters: a
 * change to one of them is a change to both.
 */

// Below 420px of *container* the row folds instead of shrinking (see
// fields/Row.tsx): the key takes a line of its own, value and rail keep the
// next one. The key's fold has to beat the width the table set for it — a
// class, not an inline style, so `w-full` can win here.
export const STACK = '@max-[420px]:flex-wrap @max-[420px]:gap-y-1.5'
export const STACK_KEY = '@max-[420px]:w-full'
export const STACK_RAIL =
  '@max-[420px]:w-auto @max-[420px]:any-pointer-coarse:[&_button]:h-11 @max-[420px]:any-pointer-coarse:[&_button]:w-11'
// Stacked, a value wraps rather than truncates: a cut token is useless, and
// there is no hover to find the copy button with.
export const STACK_VALUE = '@max-[420px]:h-auto @max-[420px]:whitespace-normal @max-[420px]:break-all'

// Two 28px controls wide (28 + gap 4 + 28), like FieldRow's rail.
export const RAIL = 'flex w-[60px] flex-none items-center justify-end gap-1'

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
export const keyColumn = (vars: { key: string }[]): CSSProperties =>
  ({
    '--key-col': `clamp(128px, ${Math.max(0, ...vars.map(v => v.key.length))}ch, 40%)`
  }) as CSSProperties

// Fixed masks, like Field's and PrivateKey's: they say nothing about length.
export const DOTS = '•'.repeat(12)
export const FILE_DOTS = '•'.repeat(24)

// Set to its own content height (NoteField's helper). A value with a newline
// in it grows its box; a capped box scrolls once it hits its `max-h`.
export const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`
}

// Focus with the caret at the end, for a box that took over typing mid-word.
export const focusEnd = (el: HTMLInputElement | null) => {
  if (!el) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
}
