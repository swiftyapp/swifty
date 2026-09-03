import { useEffect, useRef } from 'react'
import { cx } from '@/utils/cx'
import { useStore, setCurrentEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { relativeTime } from '@/utils/time'
import { t } from '@/i18n'
import { StarGlyph } from '../../../icons'
import { stampOf } from '../order'
import Flag from './Flag'
import { flagOf } from './audit'

interface Props {
  entry: EntryMeta
}

export default function Item({ entry }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const selected = useStore(state => state.entries.current?.id === entry.id)
  // Read the flag off the audit the vault already ran on unlock — never score
  // a password during a row render (see src/hooks/useStrength.ts).
  const flagKind = useStore(state => flagOf(state.audit?.[entry.id]))

  const flag = flagKind ? <Flag kind={flagKind} /> : undefined
  // A tombstone's one useful stamp is when it went, and it needs the word: "3d"
  // alone would read as "edited 3 days ago" exactly like every live row.
  const meta = entry.deletedAt
    ? `${t('Deleted')} ${relativeTime(entry.deletedAt)}`
    : relativeTime(stampOf(entry))
  const Content = kindOf(entry.type).ListRow

  // Keep the selected row in view when the keyboard walks past the fold, and
  // carry focus along only when the list already had it: arrowing from the
  // search field must leave the caret in the field.
  useEffect(() => {
    if (!selected) return
    ref.current?.scrollIntoView({ block: 'nearest' })
    // Still an option at this point even when the arrows just moved off it:
    // dropping a focused row to tabIndex -1 does not blur it, so the row being
    // left keeps focus until this one takes it.
    if (document.activeElement?.getAttribute('role') === 'option') ref.current?.focus()
  }, [selected])

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={selected}
      // One tab stop for the whole list: Tab lands on the selection, and the
      // arrows take over from there.
      tabIndex={selected ? 0 : -1}
      className={cx(
        'flex cursor-pointer items-center gap-3 border-l-2 py-2.5 pl-[14px] pr-4',
        'shadow-[inset_0_-1px_0_var(--c-line)]',
        selected
          ? 'border-accent bg-sel'
          : 'border-transparent hover:bg-hover'
      )}
      data-testid="entry-item"
      onClick={() => setCurrentEntry(entry.id)}
    >
      <Content entry={entry} flag={flag} />
      {entry.favorite && (
        <span data-testid="entry-item-star" className="flex-none text-accent">
          <StarGlyph size={12} filled />
        </span>
      )}
      {meta && (
        <span className="flex-none font-mono text-xs text-text3">{meta}</span>
      )}
    </div>
  )
}
