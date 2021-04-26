import React, { useState } from 'react'
import NewUser from 'new_user.svg'
import Enter from './enter'
import Confirm from './confirm'

export default ({ goBack }) => {
  const { i18n } = window
  const [hashedSecret, setHashedSecret] = useState(null)

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <NewUser width="48" />
        <h2>{i18n('Account Setup')}</h2>
        <div className="instructions">{i18n('Setup Instructions')}</div>
      </div>
      <Enter
        display={hashedSecret === null}
        goBack={goBack}
        onEnter={setHashedSecret}
      />
      <Confirm display={hashedSecret !== null} hashedSecret={hashedSecret} />
    </div>
  )
}
