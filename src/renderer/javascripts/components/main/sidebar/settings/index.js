import React, { useState } from 'react'
import Modal from 'components/elements/modal'
import Navigation from './navigation'
import Vault from './vault'
import SettingsIcon from 'settings.svg'

const Settings = () => {
  const [modal, setModal] = useState(false)

  return (
    <div className="settings">
      <SettingsIcon width="28" height="28" onClick={() => setModal(!modal)} />
      {modal && (
        <Modal onClose={() => setModal(!modal)}>
          <div className="preferences">
            <Navigation onClick={section => this.onNavigate(section)} />
            <div className="body">
              <Vault />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Settings
