import React, { useState } from 'react'
import classnames from 'classnames'

const MasterPassword = ({ section }) => {
  const { i18n } = window
  if (section !== 'masterpassword') return null
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

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
      setProcessing(true)
      setError(null)
      setSuccess(null)
      window.MessagesAPI.updateMasterPassword({
        current: window.CryptorAPI.hashSecret(currentPassword),
        new: window.CryptorAPI.hashSecret(newPassword)
      })
        .then(handleSuccess)
        .catch(handleErrors)
        .finally(() => setProcessing(false))
    }
  }
  const handleSuccess = () => {
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirmation('')
    setSuccess(i18n('Successfully changed password'))
  }

  const handleErrors = error => {
    setError(error.message)
  }

  return (
    <>
      <h1>{i18n('Change Master Password')}</h1>
      <div className="section">
        <strong>{i18n('Current Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="current_password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>{i18n('New Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="new_password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>{i18n('Repeat New Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="new_password_repeat"
            value={newPasswordConfirmation}
            onChange={e => setNewPasswordConfirmation(e.target.value)}
          />
        </div>
      </div>
      <div className="status-button">
        <span
          onClick={onButtonClick}
          className={classnames('button', {
            disabled: isButtonDisabled(),
            loading: processing
          })}
        >
          {i18n('Update')}
        </span>
        {error && <span className="danger">{error}</span>}
        {success && <span className="success">{success}</span>}
      </div>
    </>
  )
}

export default MasterPassword
