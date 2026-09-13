import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Masterpass from '@/components/elements/Masterpass'
import PasswordStrength from '@/components/elements/PasswordStrength'
import Button from '@/components/elements/Button'
import { evaluate, MIN_LENGTH } from '@/services/strength'
import StepHeader from '../shared/StepHeader'
import { COLUMN } from '../shared/layout'
import { messageOf } from '../shared/errors'

interface Props {
  onBack: () => void
  /**
   * Hands the accepted password on. Resolves when the flow has moved; rejects
   * with whatever the backend said if this was the last step (a Drive the user
   * already signed into skips the sync question, so Continue creates outright).
   */
  onContinue: (password: string) => Promise<void>
}

// Choosing the master password, both fields on one screen. They belong
// together: the second is a check on the first, not a step of its own, and
// splitting them made the user commit to a password before ever seeing the
// question "and again?".
export default function Password({ onBack, onContinue }: Props) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Returns the message, so the two entry points (Enter on the first field,
  // and Continue) agree on what makes a password acceptable.
  const strengthError = (): string | null => {
    if (!password) return t('Fill in the password')
    const { tooShort, acceptable } = evaluate(password)
    if (tooShort) return t('Use at least {{count}} characters', { count: MIN_LENGTH })
    if (!acceptable) return t('Choose a stronger master password')
    return null
  }

  const changePassword = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const changeConfirmation = (event: ChangeEvent<HTMLInputElement>) => {
    setMismatch(null)
    setConfirmation(event.currentTarget.value)
  }

  const submit = () => {
    if (busy) return
    const weak = strengthError()
    if (weak) return setError(weak)
    if (password !== confirmation) return setMismatch(t('Passwords do not match'))

    setBusy(true)
    onContinue(password).catch((err: unknown) => {
      setBusy(false)
      setMismatch(messageOf(err) || t('Something went wrong'))
    })
  }

  return (
    <AuthShell onBack={onBack}>
      <StepHeader
        eyebrow={t('Get started · 1 of 2')}
        title={t('Choose a master password')}
        body={t("Swifty can't reset it for you, so pick one you'll remember.")}
      />

      <div className={`${COLUMN} mt-9`}>
        <Masterpass
          placeholder={t('Master password')}
          testid="setup-password-input"
          error={error}
          onEnter={() => setError(strengthError())}
          onChange={changePassword}
        />
        <PasswordStrength password={password} />

        <div className="mt-6">
          <Masterpass
            placeholder={t('Type it once more')}
            testid="setup-confirm-password-input"
            autoFocus={false}
            error={mismatch}
            onEnter={submit}
            onChange={changeConfirmation}
          />
        </div>

        <div className="mt-8">
          <Button block testid="setup-continue-button" loading={busy} onClick={submit}>
            {t('Continue')}
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
