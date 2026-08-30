import { useState, type ChangeEvent } from 'react'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Back from '@/assets/images/back.svg?react'

interface Props {
  display: boolean
  onEnter: (password: string) => void
  goBack: () => void
}

export default function Enter({ display, onEnter, goBack }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const onSend = () => {
    if (password) onEnter(password)
    else setError(t('Fill in the password'))
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder={t('Set Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {t('Continue')}
      </div>
      <span className="navigate-back" onClick={goBack}>
        <Back width="15" /> {t('Go Back')}
      </span>
    </div>
  )
}
