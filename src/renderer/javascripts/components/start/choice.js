import React from 'react'
import NewUser from 'new_user.svg'
import Backup from 'backup.svg'

export default ({ onSelect }) => {
  return (
    <div className="lock-screen">
      <div className="top-lock">
        <NewUser width="48" />
        <h2>I am a new User</h2>
        <div className="button" onClick={() => onSelect('setup')}>
          Setup Master Password
        </div>
      </div>
      <div className="bottom-lock">
        <Backup width="48" />
        <h2>I am existing User</h2>
        <div className="button" onClick={() => onSelect('restore')}>
          Restore from Backup
        </div>
      </div>
    </div>
  )
}
