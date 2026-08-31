import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'
import { MONO_LABEL } from '../../../ui'

interface Props {
  entry: Entry
}

export default function Tags({ entry }: Props) {
  if (!entry.tags || entry.tags.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className={`mr-1 ${MONO_LABEL}`}>{t('Tags')}</span>
      {entry.tags.map(tag => (
        <span
          key={tag}
          className="grid h-6 place-items-center rounded-[7px] border border-line2 px-2.5 font-mono text-[11px] text-text2"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
