import type { EntryMeta } from '@/lib/commands'
import { t } from '@/i18n'
import Item from './Item'

interface Props {
  title: string
  entries: EntryMeta[]
}

// A labelled run of entries in either list — an audit severity ("Weak") or a
// recency bucket ("Today"). A sticky mono header (label + hairline rule +
// count) over its rows; rendered only when the group has members.
export default function Group({ title, entries }: Props) {
  if (entries.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-[1] flex items-center gap-2 bg-list px-4 pb-1.5 pt-3">
        <span className="font-mono text-xs uppercase tracking-label text-text3">
          {t(title)}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-xs text-text3">{entries.length}</span>
      </div>
      {entries.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
