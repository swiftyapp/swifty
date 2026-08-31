import { useState, type ChangeEvent } from 'react'
import { completeSetup } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Button from '@/components/elements/Button'

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
    <div>
      <Masterpass
        placeholder={t('Confirm Master Password')}
        testid="setup-confirm-password-input"
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <div className="mx-auto mt-8 w-72 max-w-full">
        <Button block testid="setup-finish-button" onClick={onSend}>
          {t('Finish')}
        </Button>
      </div>
    </div>
  )
}
