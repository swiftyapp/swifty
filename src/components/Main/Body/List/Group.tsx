import type { EntryMeta } from '@/lib/commands'
import { t } from '@/i18n'
import Item from './Item'

interface Props {
  title: string
  entries: EntryMeta[]
}

// A labelled run of entries in either list — an audit severity ("Weak") or a
// recency bucket ("Today"). A mono header (label + hairline rule + count)
// over its rows; rendered only when the group has members.
export default function Group({ title, entries }: Props) {
  if (entries.length === 0) return null

  // Keyed off the untranslated title so e2e selectors survive a locale switch.
  const slug = title.toLowerCase().replace(/\s+/g, '-')

  return (
    <div data-testid={`list-group-${slug}`}>
      <div className="flex items-center gap-2 px-4 pb-1.5 pt-3">
        <span className="font-mono text-xs uppercase tracking-label text-text3">
          {t(title)}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span data-testid="list-group-count" className="font-mono text-xs text-text3">
          {entries.length}
        </span>
      </div>
      {entries.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
