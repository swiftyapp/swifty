import type { Entry } from '@/lib/commands'
import { setFilterQuery } from '@/store'
import { t } from '@/i18n'
import { MONO_LABEL } from '@/components/elements/tokens'

interface Props {
  entry: Entry
}

// The detail pane's chips are the only tag navigation left, so each one is a
// real button: pressing it drops the tag into the list search, which is what
// "show me everything tagged this" means here. The chip keeps its look — the
// affordance is the hover and the label, not a new shape.
export default function Tags({ entry }: Props) {
  if (!entry.tags || entry.tags.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className={`mr-1 ${MONO_LABEL}`}>{t('Tags')}</span>
      {entry.tags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => setFilterQuery(tag)}
          aria-label={`${t('Filter by tag')} ${tag}`}
          className="grid h-6 place-items-center rounded-sm border border-line2 px-2.5 font-mono text-xs text-text2 hover:text-text"
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
