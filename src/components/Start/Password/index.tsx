import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Masterpass from '@/components/elements/Masterpass'
import PasswordStrength from '@/components/elements/PasswordStrength'
import Button from '@/components/elements/Button'
import { evaluate, MIN_LENGTH } from '@/services/strength'
import { useLatestRequest } from '@/hooks/useLatestRequest'
import StepHeader from '../shared/StepHeader'
import { COLUMN } from '../shared/layout'
import { describeError } from '@/api/errors'

interface Props {
  onBack: () => void
  /**
   * Hands the accepted password on. Resolves when the flow has moved; rejects
   * with whatever the backend said if this was the last step (a Drive the user
   * already signed into skips the sync question, so Continue creates outright).
   */
  onContinue: (password: string) => Promise<void>
}

// Choosing the master password. Both fields belong on one screen — the second
// is a check on the first, not a step of its own — but not at the same time:
// the screen opens with one field, and the confirmation unfolds under it once
// the password is long enough to be worth confirming. Until then the strength
// line is the only other thing on screen, and the one thing to act on.
export default function Password({ onBack, onContinue }: Props) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  // Once shown, the confirmation stays: folding it away on a backspace would
  // take what was typed into it with it.
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const begin = useLatestRequest()

  // Returns the message, so the two entry points (Enter on the first field,
  // and Continue) agree on what makes a password acceptable. Async because the
  // zxcvbn dictionaries are fetched on first use.
  const strengthError = async (): Promise<string | null> => {
    if (!password) return t('Fill in the password')
    const { tooShort, acceptable } = await evaluate(password)
    if (tooShort) return t('Use at least {{count}} characters', { count: MIN_LENGTH })
    if (!acceptable) return t('Choose a stronger master password')
    return null
  }

  // A mismatch is about the pair, so a change to either half retires it: the
  // screen never says two things about the password at once.
  const changePassword = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    setError(null)
    setMismatch(null)
    setPassword(value)
    if (value.length >= MIN_LENGTH) setConfirming(true)
  }

  const changeConfirmation = (event: ChangeEvent<HTMLInputElement>) => {
    setMismatch(null)
    setConfirmation(event.currentTarget.value)
  }

  // Enter on the first field reports what is wrong with it; it does not submit.
  const reportStrength = () => {
    void strengthError()
      .then(setError)
      .catch(() => setError(t('Something went wrong')))
  }

  // Busy goes up before the check, not after it: the check now awaits a chunk
  // fetch, and that window must not let a second press through.
  const submit = async () => {
    if (busy) return
    const current = begin()
    setBusy(true)

    let weak: string | null
    try {
      weak = await strengthError()
    } catch {
      // The chunk never arrived. Say so rather than leaving the form locked on
      // a check that will never answer.
      if (current()) {
        setBusy(false)
        setError(t('Something went wrong'))
      }
      return
    }
    // The screen may have been left, or a newer submission started, while the
    // chunk was in flight: this answer is about a password nobody is waiting on.
    if (!current()) return

    if (weak) {
      setBusy(false)
      return setError(weak)
    }
    if (password !== confirmation) {
      setBusy(false)
      return setMismatch(t('Passwords do not match'))
    }

    onContinue(password).catch((err: unknown) => {
      if (!current()) return
      setBusy(false)
      setMismatch(describeError(err) || t('Something went wrong'))
    })
  }

  return (
    <AuthShell onBack={onBack}>
      <StepHeader
        progress={0.5}
        eyebrow={t('Get started · 1 of 2')}
        title={t('Choose a master password')}
        body={t("Rowel can't reset it for you, so pick one you'll remember.")}
      />

      <div className={`${COLUMN} mt-8`}>
        {/* Both fields go inert while a submission is pending: the check awaits
            a chunk fetch, and the value it validates has to still be the one on
            screen when it lands. What is wrong with the password is said once,
            on the strength line — the field only turns red. */}
        <Masterpass
          placeholder={t('Master password')}
          testid="setup-password-input"
          invalid={!!error}
          disabled={busy}
          onEnter={reportStrength}
          onChange={changePassword}
        />
        {/* Inset to the card's own padding so the meter reads as its caption. */}
        <div className="mt-2 px-1">
          <PasswordStrength password={password} error={error} />
        </div>

        {confirming && (
          <div className="grid animate-unfold">
            <div className="min-h-0 overflow-hidden pt-3">
              <Masterpass
                placeholder={t('Type it once more')}
                testid="setup-confirm-password-input"
                autoFocus={false}
                error={mismatch}
                disabled={busy}
                onEnter={() => void submit()}
                onChange={changeConfirmation}
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button block testid="setup-continue-button" loading={busy} onClick={() => void submit()}>
            {t('Continue')}
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
