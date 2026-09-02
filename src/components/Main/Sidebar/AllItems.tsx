import { useStore, setView } from '@/store'
import { t } from '@/i18n'
import RailButton from '@/components/elements/RailButton'
import { GridRailGlyph } from '../icons'

// The rail's one entry-list destination. Kinds are a filter inside this view
// (the chip row above the list), not separate rail tiles, so the rail carries
// exactly two places to be: the items and the audit.
export default function AllItems() {
  const selected = useStore(state => state.ui.view === 'items')

  return (
    <RailButton
      label={t('All Items')}
      selected={selected}
      onClick={() => setView('items')}
      testid="view-items"
    >
      <GridRailGlyph />
    </RailButton>
  )
}
