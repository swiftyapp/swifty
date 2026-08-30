import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'
import Item from '../Item'

interface Props {
  title: string
  level: string
  entries: Entry[]
}

export default function Group({ title, level, entries }: Props) {
  if (entries.length === 0) return null

  return (
    <div className={`audit-group ${level}`}>
      <div className="title">{t(title)}</div>
      {entries.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
