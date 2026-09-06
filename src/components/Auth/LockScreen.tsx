import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'
import Masterpass from '@/components/elements/Masterpass'
import BiometricTile from './BiometricTile'
import { useUnlock } from './useUnlock'

interface Props {
  touchID: boolean
}

// The phone lock screen. Same parts as the wide one and the same `useUnlock`,
// ordered for a thumb instead of a keyboard: the biometric tile leads when a
// key is enrolled and the passphrase card is one tap away under it. Without an
// enrollment there is nothing to lead with, so the card shows straight away.
export default function LockScreen({ touchID }: Props) {
  const { t } = useTranslation()
  const { mascot, eyebrow, field, submit, biometric, change } = useUnlock()
  // Derived, not seeded: `touchID` only becomes true once the launch probe
  // (`isBiometricAvailable`) answers, which is after this mounts — a card
  // seeded from the first render would never give way to the tile.
  const [revealed, setRevealed] = useState(false)
  const password = revealed || !touchID

  return (
    <AuthShell>
      <div className="mb-7 flex justify-center">
        <Mascot state={mascot.state} gaze={mascot.gaze} />
      </div>
      <Eyebrow tone={eyebrow.tone} busy={eyebrow.busy} testid={eyebrow.testid}>
        {eyebrow.text}
      </Eyebrow>

      {password ? (
        <div className="mt-8">
          {/* The card keeps its own biometric segment, so revealing the
              passphrase never takes the faster way out away. */}
          <Masterpass
            variant="lock"
            touchID={touchID}
            testid="unlock-password-input"
            invalid={field.invalid}
            success={field.success}
            pending={field.pending}
            disabled={field.disabled}
            onChange={change}
            onEnter={submit}
            onTouchID={biometric}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex justify-center">
            <BiometricTile onUnlock={biometric} />
          </div>
          {/* 52px, the phone's secondary tier: bordered rather than filled, so
              the tile above stays the one thing being offered. */}
          <button
            type="button"
            data-testid="use-password-button"
            onClick={() => setRevealed(true)}
            className="mt-10 flex h-13 w-full cursor-pointer items-center justify-center rounded-xl border border-line2 text-md font-medium text-text transition-colors active:bg-hover"
          >
            {t('Enter Master Password')}
          </button>
        </>
      )}
    </AuthShell>
  )
}
