import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from '@/utils/cx'

/**
 * Which stock the face is cut from (see the `--paper-*` and `--slate-*` sets in
 * theme.css). `paper` is fixed light: an ID document stays paper when the app
 * goes dark, the way the credit card stays black plastic. `slate` follows the
 * theme: the same paper on the light palette, and on the dark one a slab a shade
 * off the pane — the SSH fingerprint plate is an object of the app, not of the
 * world, so it sits in the dark rather than glowing out of it.
 */
export type Tone = 'paper' | 'slate'

// What a face is made of; every part comes from the tone's set, so the two
// tones can only ever differ in colour, never in shape.
const PARTS = ['bg', 'sheen', 'edge', 'shadow', 'ink', 'ink2', 'rule', 'tail', 'hover'] as const

// Whatever is printed on a face takes its inks from these — `text-(--face-ink2)`,
// `border-(--face-rule)`, `hover:bg-(--face-hover)` — and never a colour of its own.
const vars = (tone: Tone): CSSProperties =>
  Object.fromEntries(PARTS.map(part => [`--face-${part}`, `var(--${tone}-${part})`]))

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone
}

/*
 * The surface every object in the vault is set on: an ID document, the SSH
 * key's fingerprint plate, an API key's card. They are one kind of thing on the
 * page, so they share one face, whatever their size and what is printed on it —
 * a 16px radius, a 1px
 * edge, a shadow just deep enough to lift it off the pane, and a sheen from the
 * top-right corner laid over the printing. Every other attribute — a test id, a
 * data attribute the e2e suite reads — passes through.
 */
export default function Face({ tone = 'paper', className, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      style={vars(tone)}
      className={cx(
        'relative overflow-hidden rounded-[16px] border border-(--face-edge) bg-(image:--face-bg) text-(--face-ink) tabular-nums shadow-(--face-shadow)',
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-(image:--face-sheen)" />
      {children}
    </div>
  )
}
