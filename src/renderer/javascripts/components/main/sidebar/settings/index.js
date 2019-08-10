import React, { useState } from 'react'
import Modal from 'components/elements/modal'
import Navigation from './navigation'
import Vault from './vault'
import Password from './password'
import SettingsIcon from 'settings.svg'

const Settings = () => {
  const [modal, setModal] = useState(false)
  const [section, setSection] = useState('vault')

  return (
    <div className="settings">
      <SettingsIcon width="28" height="28" onClick={() => setModal(!modal)} />
      {modal && (
        <Modal onClose={() => setModal(!modal)}>
          <div className="preferences">
            <Navigation section={section} onClick={setSection} />
            <div className="body">
              <Vault section={section} />
              <Password section={section} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Settings
