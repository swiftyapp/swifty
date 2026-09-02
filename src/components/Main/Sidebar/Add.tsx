import { useStore, newEntry, setView } from '@/store'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import { PlusGlyph } from '../icons'

export default function Add() {
  const type = useStore(state => state.filters.type)
  const view = useStore(state => state.ui.view)

  // Interim: the kind comes from whatever the list is filtered to, falling back
  // to a login. A kind-picker modal replaces this — it will call
  // `newEntry(type)` with an explicit choice.
  const onAddEntry = () => {
    if (view === 'health') setView('items')
    newEntry(type ?? 'login')
  }

  return (
    <Tooltip content={t('New Secret')}>
      <div
        data-testid="add-entry-button"
        onClick={onAddEntry}
        className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-dashed border-accent-line text-accent transition-colors hover:bg-accent-soft"
      >
        <PlusGlyph size={18} />
      </div>
    </Tooltip>
  )
}
