import { useState } from 'react'
import { useStore, openSettings, closeSettings } from '@/store'
import { t } from '@/i18n'
import Modal from '@/components/elements/Modal'
import Tooltip from '@/components/elements/Tooltip'
import Navigation, { type Section } from './Navigation'
import Vault from './Vault'
import Import from './Import'
import MasterPassword from './MasterPassword'
import Biometric from './Biometric'
import Password from './Password'
import Audit from './Audit'
import Language from './Language'
import Updates from './Updates'
import { GearGlyph } from '../../icons'

export default function Settings() {
  // Open state lives in the store so the ⌘K palette can open Settings too.
  const modal = useStore(state => state.ui.settings)
  const [section, setSection] = useState<Section>('vault')

  return (
    <div className="settings">
      <Tooltip content={t('Settings')}>
        <div
          className="settings-button grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-text2 transition-colors hover:bg-hover hover:text-text"
          data-testid="settings-button"
          onClick={() => (modal ? closeSettings() : openSettings())}
        >
          <GearGlyph size={18} />
        </div>
      </Tooltip>
      {modal && (
        <Modal onClose={closeSettings}>
          <div className="preferences flex max-h-[80vh] min-h-[560px] w-full text-text">
            <Navigation section={section} onClick={setSection} />
            <div className="body flex-1 overflow-y-auto p-7">
              <Vault section={section} />
              <Import section={section} />
              <MasterPassword section={section} />
              <Biometric section={section} />
              <Password section={section} />
              <Audit section={section} />
              <Language section={section} />
              <Updates section={section} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
