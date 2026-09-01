import { cx } from '@/utils/cx'
import { useStore, setCurrentEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { relativeTime } from '@/utils/time'
import { stampOf } from '../order'
import Login from './Login'
import Card from './Card'
import Note from './Note'
import Flag from './Flag'
import { flagOf } from './audit'

interface Props {
  entry: EntryMeta
}

export default function Item({ entry }: Props) {
  const selected = useStore(state => state.entries.current?.id === entry.id)
  // Read the flag off the audit the vault already ran on unlock — never score
  // a password during a row render (see src/hooks/useStrength.ts).
  const flagKind = useStore(state => flagOf(state.audit?.[entry.id]))

  const flag = flagKind ? <Flag kind={flagKind} /> : undefined
  const meta = relativeTime(stampOf(entry))

  const content = () => {
    switch (entry.type) {
      case 'login':
        return <Login entry={entry} flag={flag} />
      case 'card':
        return <Card entry={entry} flag={flag} />
      case 'note':
        return <Note entry={entry} flag={flag} />
    }
  }

  return (
    <div
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
      {content()}
      {meta && (
        <span className="flex-none font-mono text-xs text-text3">{meta}</span>
      )}
    </div>
  )
}
