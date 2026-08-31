import { useState, type ChangeEvent } from 'react'
import { completeSetup } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'

interface Props {
  display: boolean
  password: string
}

export default function Confirm({ display, password }: Props) {
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setConfirmation(event.currentTarget.value)
  }

  const onSend = () => {
    if (password === confirmation) completeSetup(password)
    else setError(t('Passwords do not match'))
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder={t('Confirm Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {t('Finish')}
      </div>
    </div>
  )
}
