import { useTranslation } from 'react-i18next'
import { useStore, setFilterTag } from '@/store'
import Chip from './Chip'

// Why the list is short. The tag filter is set from the rail, two panes away,
// so the column it narrows says so itself — and offers the way out.
export default function ActiveTag() {
  const { t } = useTranslation()
  const tag = useStore(state => state.filters.tag)
  if (!tag) return null

  return (
    <div className="mt-2 flex">
      <Chip
        testid="active-tag"
        label={`#${tag}`}
        title={t('Clear tag filter')}
        selected
        dismiss
        onClick={() => setFilterTag(null)}
      />
    </div>
  )
}
