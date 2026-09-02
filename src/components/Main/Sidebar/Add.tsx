import { useStore, openAddPicker, setView } from '@/store'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import { PlusGlyph } from '../icons'

export default function Add() {
  const view = useStore(state => state.ui.view)

  // The kind is asked for, never inferred: this opens the picker
  // (Main/AddSecret). Leaving the audit view first gives the form it starts a
  // list to land in.
  const onAddEntry = () => {
    if (view === 'health') setView('items')
    openAddPicker()
  }

  return (
    <Tooltip content={t('Add a secret')}>
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
