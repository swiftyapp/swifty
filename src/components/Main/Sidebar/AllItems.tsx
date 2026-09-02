import { cx } from '@/utils/cx'
import { useStore, setView } from '@/store'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import { AllItemsGlyph } from '../icons'

// The rail's one entry-list destination. Kinds are a filter inside this view
// (the chip row above the list), not separate rail tiles, so the rail carries
// exactly two places to be: the items and the audit.
export default function AllItems() {
  const selected = useStore(state => state.ui.view === 'items')

  return (
    <Tooltip content={t('All Items')}>
      <div
        data-testid="view-items"
        onClick={() => setView('items')}
        className={cx(
          'relative grid h-10 w-10 cursor-pointer place-items-center rounded-lg transition-colors',
          selected ? 'bg-tile text-text' : 'text-text2 hover:bg-hover hover:text-text'
        )}
      >
        {selected && (
          <span className="absolute -left-3.5 top-3 h-4 w-0.5 rounded-full bg-accent" />
        )}
        <AllItemsGlyph size={18} />
      </div>
    </Tooltip>
  )
}
