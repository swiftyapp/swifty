import { useTranslation } from 'react-i18next'
import { useStore, setView } from '@/store'
import Chip from './Chip'

// The tag the Tags view is showing, and the way out of it: the Tags view is
// nothing without a tag, so clearing it goes back to All Items.
export default function ActiveTag() {
  const { t } = useTranslation()
  // Only the Tags view shows a tag, so only it has one to name (see
  // `useVisibleEntries` for the same scoping of the filter itself).
  const tag = useStore(state => (state.ui.view === 'tags' ? state.filters.tag : null))
  if (!tag) return null

  return (
    <div className="mt-2 flex">
      <Chip
        testid="active-tag"
        label={`#${tag}`}
        title={t('Clear tag filter')}
        selected
        dismiss
        onClick={() => setView('items')}
      />
    </div>
  )
}
