import { openAddPicker } from '@/store'
import { t } from '@/i18n'
import RailButton from '@/components/elements/RailButton'
import { PlusRailGlyph } from '../icons'

// The kind is asked for, never inferred: this only opens the picker
// (Main/AddSecret). Leaving a filtered view is `startEntry`'s job, on commit —
// doing it here navigated away from whatever the user was looking at even when
// they then dismissed the picker.
export default function Add() {
  // The rail's only action tile: a filled accent wash rather than the
  // navigation inks, so it reads as "do" and not "go".
  return (
    <RailButton
      label={t('Add a secret')}
      onClick={openAddPicker}
      testid="add-entry-button"
      action
    >
      <PlusRailGlyph />
    </RailButton>
  )
}
