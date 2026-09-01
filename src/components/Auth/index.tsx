import { useEffect, useState } from 'react'
import { unlock, unlockBiometric } from '@/lib/commands'
import { enterMain } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Controls from '@/components/elements/Controls'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'

interface Props {
  touchID: boolean
}

// Rust's `Error::TooManyAttempts` serializes as this shape (see error.rs);
// every other backend error is a plain string.
interface TooManyAttemptsError {
  retryAfterSecs: number
}

const isTooManyAttempts = (error: unknown): error is TooManyAttemptsError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as TooManyAttemptsError).retryAfterSecs === 'number'

// Rust's `Error::VaultTooNew` (see error.rs) — the vault's schema is ahead of
// this build. Shown as its own message: blaming the password would be wrong.
const isVaultTooNew = (error: unknown): boolean =>
  error === 'vault requires a newer version of the app'

const unlockError = (error: unknown): string =>
  isVaultTooNew(error)
    ? t('Vault needs a newer version of Swifty')
    : t('Incorrect Master Password')

const lockedMessage = (seconds: number) =>
  `${t('Too many failed attempts')}. ${t('Try again in')} ${seconds}s`

export function Auth({ touchID }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState(0)

  // Countdown ticks once a second while locked out; re-enables the input at 0.
  useEffect(() => {
    if (retryAfter <= 0) return
    const id = setTimeout(() => {
      const next = retryAfter - 1
      setRetryAfter(next)
      setError(next > 0 ? lockedMessage(next) : null)
    }, 1000)
    return () => clearTimeout(id)
  }, [retryAfter])

  const handleEnter = (value: string) => {
    if (retryAfter > 0) return
    unlock(value)
      .then(result => enterMain(result))
      .catch((err: unknown) => {
        if (isTooManyAttempts(err)) {
          setRetryAfter(err.retryAfterSecs)
          setError(lockedMessage(err.retryAfterSecs))
        } else {
          setError(unlockError(err))
        }
      })
  }

  const handleTouchId = () => {
    // Biometric unlock is never subject to the password backoff (the OS gate
    // already rate-limits it), so it stays available even while locked out.
    unlockBiometric()
      .then(result => enterMain(result))
      .catch((err: unknown) => setError(unlockError(err)))
  }

  return (
    <>
      <Controls />
      <AuthShell meta={`${t('offline')} · aes-256-gcm`}>
        <Eyebrow tone={error ? 'bad' : 'muted'}>
          {error ?? t('Vault sealed')}
        </Eyebrow>
        <div className="mt-8">
          <Masterpass
            variant="lock"
            touchID={touchID}
            testid="unlock-password-input"
            invalid={!!error}
            disabled={retryAfter > 0}
            onChange={() => retryAfter <= 0 && setError(null)}
            onEnter={handleEnter}
            onTouchID={handleTouchId}
          />
        </div>
      </AuthShell>
    </>
  )
}

export default Auth
