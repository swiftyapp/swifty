import { useState } from 'react'
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
  const [modal, setModal] = useState(false)
  const [section, setSection] = useState<Section>('vault')

  return (
    <div className="settings">
      <Tooltip content={t('Settings')}>
        <div
          className="settings-button grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-text2 transition-colors hover:bg-hover hover:text-text"
          data-testid="settings-button"
          onClick={() => setModal(!modal)}
        >
          <GearGlyph />
        </div>
      </Tooltip>
      {modal && (
        <Modal onClose={() => setModal(false)}>
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
