import { useState, type ChangeEvent } from 'react'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import PasswordStrength from '@/components/elements/PasswordStrength'
import Button from '@/components/elements/Button'
import { evaluate, MIN_LENGTH } from '@/services/strength'

interface Props {
  display: boolean
  onEnter: (password: string) => void
}

export default function Enter({ display, onEnter }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const onSend = () => {
    if (!password) return setError(t('Fill in the password'))
    const { tooShort, acceptable } = evaluate(password)
    if (tooShort)
      return setError(`${t('Use at least')} ${MIN_LENGTH} ${t('characters')}`)
    if (!acceptable) return setError(t('Choose a stronger master password'))
    onEnter(password)
  }

  if (!display) return null

  return (
    <div>
      <Masterpass
        placeholder={t('Set Master Password')}
        testid="setup-password-input"
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <PasswordStrength password={password} />
      <div className="mx-auto mt-8 w-72 max-w-full">
        <Button testid="setup-continue-button" onClick={onSend}>
          {t('Continue')}
        </Button>
      </div>
    </div>
  )
}
