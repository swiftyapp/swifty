import { useTranslation } from 'react-i18next'
import { useStore, openSettings, closeSettings } from '@/store'
import RailButton from '@/components/elements/RailButton'
import SettingsModal from './SettingsModal'
import { GearRailGlyph } from '../../icons'

export default function Settings() {
  const { t } = useTranslation()
  // Open state lives in the store so the ⌘K palette can open Settings too.
  const modal = useStore(state => state.ui.settings)

  return (
    <div className="settings">
      <RailButton
        label={t('Settings')}
        testid="settings-button"
        className="settings-button"
        onClick={() => (modal ? closeSettings() : openSettings())}
      >
        <GearRailGlyph />
      </RailButton>
      {modal && <SettingsModal />}
    </div>
  )
}
