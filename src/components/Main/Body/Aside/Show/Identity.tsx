import type { ReactNode } from 'react'
import type { EntryMeta } from '@/lib/commands'
import { cx } from '@/utils/cx'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { hasBrandMark } from '@/utils/cardBrand'
import { kindOf } from '@/kinds'
import { useFavicon } from '@/hooks/useFavicon'

interface Props {
  entry: EntryMeta
  /** The tile's box — 28px in the desktop header, 60px on the phone screen. */
  tile: string
  /** The mark inside it, in px. Scales with the tile; nothing else does. */
  glyph: number
  /** The row the tile and the title sit on. */
  className?: string
  /** An eyebrow to share the title's column with (the phone puts it here). */
  children?: ReactNode
}

// Who the entry is: its own artwork if it has any — a favicon, a card brand
// mark — and the kind's glyph otherwise, beside the title. One component, two
// sizes: both shells draw the same identity, only bigger where there is room.
export default function Identity({ entry, tile, glyph, className, children }: Props) {
  const icon = useFavicon(entry.urlHost)
  const Glyph = kindOf(entry.type).Glyph
  // Brand marks are wider than they are tall, so they ride 4px under the kind
  // glyph's edge at every size — the pairing the header has always drawn.
  const mark = glyph - 4
  const title = (
    <h1 className="truncate text-2xl font-semibold tracking-display text-text">
      {entry.title}
    </h1>
  )

  return (
    <div className={className}>
      <div
        className={cx(
          'grid',
          tile,
          'flex-none place-items-center overflow-hidden rounded-lg bg-tile text-text2'
        )}
      >
        {icon ? (
          <img src={icon} alt="" className="h-full w-full object-cover" />
        ) : hasBrandMark(entry.cardBrand) ? (
          <CardBrandMark brand={entry.cardBrand} size={mark} />
        ) : (
          <Glyph size={glyph} />
        )}
      </div>
      {/* Given an eyebrow, the title stops being the row's only text and the
          two share a column; without one it is the row itself. */}
      {children ? (
        <div className="min-w-0 flex-1">
          {children}
          {title}
        </div>
      ) : (
        title
      )}
    </div>
  )
}
