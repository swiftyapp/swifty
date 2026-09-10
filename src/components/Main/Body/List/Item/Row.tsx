import type { ReactNode } from 'react'
import type { EntryMeta } from '@/lib/commands'
import type { Kind } from '@/kinds/types'
import { KIND_TINT } from '@/kinds/tint'
import { cx } from '@/utils/cx'
import { META } from '@/components/elements/tokens'

// What every kind's list row component is handed (see src/kinds/*/ListRow).
export interface ContentProps {
  entry: EntryMeta
  flag?: ReactNode
}

interface Props {
  glyph: ReactNode
  title: string
  sub?: string
  flag?: ReactNode
  // Set only when the tile shows the kind's generic glyph. A favicon or card
  // brand mark is the entry's own identity and gets the neutral tile instead —
  // tinting behind real artwork would just muddy it.
  tint?: Kind['tint']
}

// Shared inner layout for every list item, whatever its kind: a rounded glyph
// tile, the title (with an optional audit flag beside it), and an optional muted
// secondary line. The kind-specific bits (which glyph, which secondary text)
// live in src/kinds so this stays a single source of truth for spacing and
// typography.
export default function Row({ glyph, title, sub, flag, tint }: Props) {
  return (
    <>
      <div
        className={cx(
          // The tile grows with the row it sits in (see Item/index.tsx).
          'grid h-[30px] w-[30px] flex-none place-items-center overflow-hidden rounded-lg any-pointer-coarse:h-10 any-pointer-coarse:w-10',
          tint ? KIND_TINT[tint] : 'bg-tile text-text2'
        )}
      >
        {glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[7px]">
          <span
            data-testid="entry-item-title"
            className="truncate text-base font-medium text-text"
          >
            {title}
          </span>
          {flag}
        </div>
        {sub && (
          <div className={`mt-0.5 truncate ${META}`}>
            {sub}
          </div>
        )}
      </div>
    </>
  )
}
