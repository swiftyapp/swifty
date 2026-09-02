import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { unlock, unlockBiometric, type UnlockResult } from '@/lib/commands'
import { enterMain } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Controls from '@/components/elements/Controls'
import AuthShell from '@/components/elements/AuthShell'
import { useAuthMeta } from '@/components/elements/useAuthMeta'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'

// How long the mascot gets to celebrate before the vault fades in.
const SUCCESS_HOLD_MS = 650

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

// A biometric failure is never a password problem: the backend's errors here
// are a cancelled/failed prompt, a missing enrollment, or a keychain issue.
// Claiming "Incorrect Master Password" for any of them would send the user
// retyping a password that was never checked.
const biometricError = (error: unknown): string =>
  isVaultTooNew(error) ? t('Vault needs a newer version of Swifty') : t('Biometric unlock failed')

const lockedMessage = (seconds: number) =>
  `${t('Too many failed attempts')}. ${t('Try again in')} ${seconds}s`

export function Auth({ touchID }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState(0)
  const [count, setCount] = useState(0)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const holdTimer = useRef(0)
  const meta = useAuthMeta()

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

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  // Let the mascot celebrate before the vault takes over.
  const holdThenEnter = (result: UnlockResult) => {
    setError(null)
    setSuccess(true)
    holdTimer.current = window.setTimeout(
      () => enterMain(result),
      SUCCESS_HOLD_MS
    )
  }

  const handleEnter = (value: string) => {
    if (retryAfter > 0 || success || pending) return
    // Key derivation is deliberately slow; acknowledge the Enter immediately
    // (and drop any stale error — this attempt owns the eyebrow now).
    setError(null)
    setPending(true)
    unlock(value)
      .then(result => {
        setPending(false)
        holdThenEnter(result)
      })
      .catch((err: unknown) => {
        setPending(false)
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
    if (success || pending) return
    setError(null)
    setPending(true)
    unlockBiometric()
      .then(result => {
        setPending(false)
        holdThenEnter(result)
      })
      .catch((err: unknown) => {
        setPending(false)
        setError(biometricError(err))
      })
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCount(event.currentTarget.value.length)
    if (retryAfter <= 0) setError(null)
  }

  // The mascot reads along as you type: the gaze pans left-to-right with the
  // caret (16 chars ≈ full sweep, like the prototype).
  const gaze = count > 0 ? Math.min(1, count / 16) * 2 - 1 : 0
  const mascotState = success
    ? 'success'
    : error
      ? 'error'
      : pending
        ? 'checking'
        : count > 0
          ? 'typing'
          : 'idle'

  return (
    <>
      <Controls />
      <AuthShell meta={meta}>
        <div className="mb-7 flex justify-center">
          <Mascot state={mascotState} gaze={gaze} />
        </div>
        {/* One element carries all three states, so the testid names which one
            is showing rather than forcing specs to parse the message. */}
        <Eyebrow
          tone={error ? 'bad' : success ? 'accent' : 'muted'}
          busy={pending}
          testid={
            retryAfter > 0
              ? 'unlock-lockout'
              : error
                ? 'unlock-error'
                : 'unlock-status'
          }
        >
          {error ??
            (success
              ? t('Unsealing')
              : pending
                ? t('Verifying')
                : t('Vault sealed'))}
        </Eyebrow>
        <div className="mt-8">
          <Masterpass
            variant="lock"
            touchID={touchID}
            testid="unlock-password-input"
            invalid={!!error}
            success={success}
            pending={pending}
            disabled={retryAfter > 0 || success || pending}
            onChange={handleChange}
            onEnter={handleEnter}
            onTouchID={handleTouchId}
          />
        </div>
      </AuthShell>
    </>
  )
}

export default Auth
