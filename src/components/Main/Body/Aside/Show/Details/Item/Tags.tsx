import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'

interface Props {
  entry: Entry
}

export default function Tags({ entry }: Props) {
  if (!entry.tags || entry.tags.length === 0) return null

  return (
    <div className="item">
      <div className="label">{t('Tags')}</div>
      <div className="value">
        {entry.tags.map(tag => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
