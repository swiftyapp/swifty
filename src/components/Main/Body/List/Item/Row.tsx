import type { ReactNode } from 'react'
import type { EntryMeta } from '@/lib/commands'

// What every type-specific row component (Login / Card / Note) is handed.
export interface ContentProps {
  entry: EntryMeta
  flag?: ReactNode
}

interface Props {
  glyph: ReactNode
  title: string
  sub?: string
  flag?: ReactNode
}

// Shared inner layout for every list item, whatever its type: a rounded
// `bg-tile` glyph tile, the title (with an optional audit flag beside it), and
// an optional mono secondary line. The type-specific bits (which glyph, which
// secondary text) live in Login / Card / Note so this stays a single source of
// truth for spacing and typography.
export default function Row({ glyph, title, sub, flag }: Props) {
  return (
    <>
      <div className="grid h-[30px] w-[30px] flex-none place-items-center overflow-hidden rounded-lg bg-tile text-text2">
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
          <div className="mt-0.5 truncate font-mono text-xs text-text3">
            {sub}
          </div>
        )}
      </div>
    </>
  )
}
