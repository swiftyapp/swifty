import React from 'react'
import NewUser from 'new_user.svg'
import Backup from 'backup.svg'

export default ({ onSelect }) => {
  const { i18n } = window

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <NewUser width="48" />
        <h2>{i18n('I am a new User')}</h2>
        <div className="button" onClick={() => onSelect('setup')}>
          {i18n('Setup Master Password')}
        </div>
      </div>
      <div className="bottom-lock">
        <Backup width="48" />
        <h2>{i18n('I am existing User')}</h2>
        <div className="button" onClick={() => onSelect('restore')}>
          {i18n('Restore from Backup')}
        </div>
      </div>
    </div>
  )
}
