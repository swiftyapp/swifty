import { useStore, openAddPicker, setView } from '@/store'
import { t } from '@/i18n'
import RailButton from '@/components/elements/RailButton'
import { PlusRailGlyph } from '../icons'

export default function Add() {
  const view = useStore(state => state.ui.view)

  // The kind is asked for, never inferred: this opens the picker
  // (Main/AddSecret). Any view but All Items is filtered or read-only, so the
  // new entry would fall straight out of it — switch first and it has a list to
  // land in.
  const onAddEntry = () => {
    if (view !== 'items') setView('items')
    openAddPicker()
  }

  // The rail's only action tile: a filled accent wash rather than the
  // navigation inks, so it reads as "do" and not "go".
  return (
    <RailButton
      label={t('Add a secret')}
      onClick={onAddEntry}
      testid="add-entry-button"
      action
    >
      <PlusRailGlyph />
    </RailButton>
  )
}
