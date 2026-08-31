import { useState, type ChangeEvent } from 'react'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import PasswordStrength from '@/components/elements/PasswordStrength'
import { evaluate, MIN_LENGTH } from '@/services/strength'
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
    if (!password) return setError(t('Fill in the password'))
    const { tooShort, acceptable } = evaluate(password)
    if (tooShort) return setError(`${t('Use at least')} ${MIN_LENGTH} ${t('characters')}`)
    if (!acceptable) return setError(t('Choose a stronger master password'))
    onEnter(password)
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder={t('Set Master Password')}
        testid="setup-password-input"
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <PasswordStrength password={password} />
      <br />
      <div className="button" data-testid="setup-continue-button" onClick={onSend}>
        {t('Continue')}
      </div>
      <span className="navigate-back" onClick={goBack}>
        <Back width="15" /> {t('Go Back')}
      </span>
    </div>
  )
}
