import React, { useState } from 'react'
import Backup from 'backup.svg'
import Import from './import'
import Confirm from './confirm'

export default ({ goBack }) => {
  const { i18n } = window
  const [step, setStep] = useState(null)
  const onImport = () => {
    setStep('confirmation')
  }

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <Backup width="48" />
        <h2>{i18n('Restore Backup')}</h2>
        <div className="instructions">{i18n('Restore Instructions')}</div>
      </div>
      <div className="bottom-lock">
        <Import
          display={step !== 'confirmation'}
          goBack={goBack}
          onImport={onImport}
        />
        <Confirm display={step === 'confirmation'} />
      </div>
    </div>
  )
}
