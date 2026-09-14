import type { ReactNode } from 'react'
import { CARD } from '@/components/elements/tokens'

interface Props {
  /** A glyph at the row/tile tier (16), inked by the tile around it. */
  glyph: ReactNode
  title: string
  body: string
  /** Muted rather than accent, for the option that is the quieter of the two. */
  muted?: boolean
  onClick: () => void
  testid?: string
}

// One of the ways back into your own data, as a card you can press: a tinted
// glyph tile, a name and a line of what it means. Two of them sit side by side
// on a desktop and stack on a phone (the grid is the caller's).
export default function OptionCard({ glyph, title, body, muted, onClick, testid }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={`${CARD} flex cursor-pointer flex-col gap-2 p-3.5 text-left transition-colors hover:border-accent-line`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-sm bg-tile ${
          muted ? 'text-text2' : 'text-accent'
        }`}
      >
        {glyph}
      </span>
      <span className="text-base font-medium text-text">{title}</span>
      <span className="text-base leading-relaxed text-text2">{body}</span>
    </button>
  )
}
