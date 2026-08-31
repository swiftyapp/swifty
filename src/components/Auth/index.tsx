import { useEffect, useState } from 'react'
import { unlock, unlockBiometric } from '@/lib/commands'
import { enterMain } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Controls from '@/components/elements/Controls'
import img from '@/assets/images/swifty.png'

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
          setError(t('Incorrect Master Password'))
        }
      })
  }

  const handleTouchId = () => {
    // Biometric unlock is never subject to the password backoff (the OS gate
    // already rate-limits it), so it stays available even while locked out.
    unlockBiometric()
      .then(result => enterMain(result))
      .catch(() => setError(t('Incorrect Master Password')))
  }

  return (
    <>
      <Controls />
      <div className="lock-screen">
        <div className="top-lock">
          <img src={img} alt="" width={72} />
        </div>
        <div className="bottom-lock">
          <Masterpass
            touchID={touchID}
            error={error}
            disabled={retryAfter > 0}
            onChange={() => retryAfter <= 0 && setError(null)}
            onEnter={handleEnter}
            onTouchID={handleTouchId}
          />
        </div>
      </div>
    </>
  )
}

export default Auth
