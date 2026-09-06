import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { unlock, unlockBiometric, type UnlockResult } from '@/lib/commands'
import { enterMain } from '@/store'
import type { MascotState } from '@/components/elements/Mascot'

// How long the mascot gets to celebrate before the vault fades in.
const SUCCESS_HOLD_MS = 650

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

const unlockError = (t: TFunction, error: unknown): string =>
  isVaultTooNew(error)
    ? t('Vault needs a newer version of the app')
    : t('Incorrect Master Password')

// A biometric failure is never a password problem: the backend's errors here
// are a cancelled/failed prompt, a missing enrollment, or a keychain issue.
// Claiming "Incorrect Master Password" for any of them would send the user
// retyping a password that was never checked.
const biometricError = (t: TFunction, error: unknown): string =>
  isVaultTooNew(error)
    ? t('Vault needs a newer version of the app')
    : t('Biometric unlock failed')

const lockedMessage = (t: TFunction, seconds: number) =>
  t('Too many failed attempts. Try again in {{seconds}}s', { seconds })

// One attempt-lifecycle slot instead of separate success/pending booleans:
// only one of these can be true at a time, and everything below derives from
// the same precedence.
type Phase = 'idle' | 'verifying' | 'success'

export interface Unlock {
  mascot: { state: MascotState; gaze: number }
  /** The status line: one element carries all three states, named by testid. */
  eyebrow: {
    text: string
    tone: 'muted' | 'bad'
    busy: boolean
    testid: string
  }
  /** How the passphrase card presents the attempt. */
  field: {
    invalid: boolean
    success: boolean
    pending: boolean
    disabled: boolean
  }
  submit: (value: string) => void
  biometric: () => void
  change: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * One unlock attempt, in whichever shell is drawing it. Every piece of state a
 * lock screen has lives here — the attempt phase, the lockout countdown, the
 * gaze the mascot reads along with — so the wide card and the phone's
 * biometric-first screen are the same behaviour laid out two ways.
 */
export function useUnlock(): Unlock {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState(0)
  const [count, setCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const holdTimer = useRef(0)

  // Countdown ticks once a second while locked out; re-enables the input at 0.
  useEffect(() => {
    if (retryAfter <= 0) return
    const id = setTimeout(() => {
      const next = retryAfter - 1
      setRetryAfter(next)
      setError(next > 0 ? lockedMessage(t, next) : null)
    }, 1000)
    return () => clearTimeout(id)
  }, [retryAfter, t])

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  // Let the mascot celebrate before the vault takes over.
  const holdThenEnter = (result: UnlockResult) => {
    setPhase('success')
    holdTimer.current = window.setTimeout(
      () => enterMain(result),
      SUCCESS_HOLD_MS
    )
  }

  const handleEnter = (value: string) => {
    if (retryAfter > 0 || phase !== 'idle') return
    // Key derivation is deliberately slow; acknowledge the Enter immediately
    // (and drop any stale error — this attempt owns the eyebrow now).
    setError(null)
    setPhase('verifying')
    unlock(value)
      .then(holdThenEnter)
      .catch((err: unknown) => {
        setPhase('idle')
        if (isTooManyAttempts(err)) {
          setRetryAfter(err.retryAfterSecs)
          setError(lockedMessage(t, err.retryAfterSecs))
        } else {
          setError(unlockError(t, err))
        }
      })
  }

  const handleTouchId = () => {
    // Biometric unlock is never subject to the password backoff (the OS gate
    // already rate-limits it), so it stays available even while locked out.
    if (phase !== 'idle') return
    setError(null)
    setPhase('verifying')
    unlockBiometric()
      .then(holdThenEnter)
      .catch((err: unknown) => {
        setPhase('idle')
        setError(biometricError(t, err))
      })
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCount(event.currentTarget.value.length)
    if (retryAfter <= 0) setError(null)
  }

  // The mascot reads along as you type: the gaze pans left-to-right with the
  // caret (16 chars ≈ full sweep, like the prototype; Mascot clamps to ±1).
  const gaze = count > 0 ? (count / 16) * 2 - 1 : 0
  const state: MascotState =
    phase !== 'idle'
      ? phase === 'success'
        ? 'success'
        : 'checking'
      : error
        ? 'error'
        : count > 0
          ? 'typing'
          : 'idle'

  return {
    mascot: { state, gaze },
    eyebrow: {
      text:
        error ??
        (phase === 'success'
          ? t('Unsealing')
          : phase === 'verifying'
            ? t('Verifying')
            : t('Vault sealed')),
      tone: error ? 'bad' : 'muted',
      busy: phase === 'verifying',
      // The testid names which of the three states is showing rather than
      // forcing specs to parse the message.
      testid:
        retryAfter > 0 ? 'unlock-lockout' : error ? 'unlock-error' : 'unlock-status'
    },
    field: {
      invalid: !!error,
      success: phase === 'success',
      pending: phase === 'verifying',
      disabled: retryAfter > 0
    },
    submit: handleEnter,
    biometric: handleTouchId,
    change: handleChange
  }
}
