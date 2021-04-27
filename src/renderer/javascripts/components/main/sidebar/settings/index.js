import React, { useState } from 'react'
import Modal from 'components/elements/modal'
import Tooltip from 'components/elements/tooltip'
import Navigation from './navigation'
import Vault from './vault'
import Password from './password'
import MasterPassword from './master_password'
import SettingsIcon from 'settings.svg'

const Settings = () => {
  const { i18n } = window
  const [modal, setModal] = useState(false)
  const [section, setSection] = useState('vault')

  return (
    <div className="settings">
      <Tooltip content={i18n('Settings')}>
        <div className="settings-button" onClick={() => setModal(!modal)}>
          <SettingsIcon />
        </div>
      </Tooltip>
      {modal && (
        <Modal onClose={() => setModal(!modal)}>
          <div className="preferences">
            <Navigation section={section} onClick={setSection} />
            <div className="body">
              <Vault section={section} />
              <MasterPassword section={section} />
              <Password section={section} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Settings
