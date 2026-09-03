import type { EntryMeta } from '@/lib/commands'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import Item from './Item'

interface Props {
  title: TKey
  entries: EntryMeta[]
}

// A labelled run of entries in the audit list — one severity ("Weak"). A mono
// header (label + hairline rule + count) over its rows; rendered only when the
// group has members. The entry list itself is flat, so this is the only caller.
export default function Group({ title, entries }: Props) {
  const { t } = useTranslation()
  if (entries.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pb-1.5 pt-3">
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
