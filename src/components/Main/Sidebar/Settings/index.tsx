import { useState } from 'react'
import { t } from '@/i18n'
import Modal from '@/components/elements/Modal'
import Tooltip from '@/components/elements/Tooltip'
import Navigation, { type Section } from './Navigation'
import Vault from './Vault'
import MasterPassword from './MasterPassword'
import Password from './Password'
import Audit from './Audit'
import Language from './Language'
import SettingsIcon from '@/assets/images/settings.svg?react'

export default function Settings() {
  const [modal, setModal] = useState(false)
  const [section, setSection] = useState<Section>('vault')

  return (
    <div className="settings">
      <Tooltip content={t('Settings')}>
        <div className="settings-button" onClick={() => setModal(!modal)}>
          <SettingsIcon />
        </div>
      </Tooltip>
      {modal && (
        <Modal onClose={() => setModal(false)}>
          <div className="preferences">
            <Navigation section={section} onClick={setSection} />
            <div className="body">
              <Vault section={section} />
              <MasterPassword section={section} />
              <Password section={section} />
              <Audit section={section} />
              <Language section={section} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
