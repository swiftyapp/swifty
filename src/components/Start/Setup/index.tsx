import { useState } from 'react'
import { t } from '@/i18n'
import NewUser from '@/assets/images/new_user.svg?react'
import Enter from './Enter'
import Confirm from './Confirm'

interface Props {
  goBack: () => void
}

export default function Setup({ goBack }: Props) {
  const [password, setPassword] = useState<string | null>(null)

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <NewUser width="48" />
        <h2>{t('Account Setup')}</h2>
        <div className="instructions">{t('Setup Instructions')}</div>
      </div>
      <Enter display={password === null} goBack={goBack} onEnter={setPassword} />
      <Confirm display={password !== null} password={password ?? ''} />
    </div>
  )
}
