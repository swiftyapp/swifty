import React, { useState } from 'react'
import classnames from 'classnames'
const { hashSecret } = window

const MasterPassword = ({ section }) => {
  if (section !== 'masterpassword') return null
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')

  const isButtonDisabled = () => {
    return (
      !currentPassword ||
      !newPassword ||
      !newPasswordConfirmation ||
      newPassword !== newPasswordConfirmation
    )
  }

  const onButtonClick = e => {
    if (!e.target.classList.contains('disabled')) {
      window
        .updateMasterPassword({
          current: hashSecret(currentPassword),
          new: hashSecret(newPassword)
        })
        .then(handleSuccess)
        .catch(handleErrors)
    }
  }
  const handleSuccess = () => {
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirmation('')
  }

  const handleErrors = errors => {
    console.log(errors)
  }

  return (
    <>
      <h1>Change Master Password</h1>
      <div className="section">
        <strong>Current Password</strong>
        <div className="threefour">
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>New Password</strong>
        <div className="threefour">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>Repeat New Password</strong>
        <div className="threefour">
          <input
            type="password"
            value={newPasswordConfirmation}
            onChange={e => setNewPasswordConfirmation(e.target.value)}
          />
        </div>
      </div>
      <div>
        <span
          onClick={onButtonClick}
          className={classnames('button', { disabled: isButtonDisabled() })}
        >
          Update
        </span>
      </div>
    </>
  )
}

export default MasterPassword
