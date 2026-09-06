import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'
import Masterpass from '@/components/elements/Masterpass'
import type { BiometryType } from '@/lib/commands'
import BiometricTile from './BiometricTile'
import { useUnlock } from './useUnlock'

interface Props {
  touchID: boolean
  /** Which gate the tile and the card's end segment name (see lib/biometry). */
  biometry?: BiometryType
}

// The phone lock screen. Same parts as the wide one and the same `useUnlock`,
// ordered for a thumb instead of a keyboard: the biometric tile leads when a
// key is enrolled and the passphrase card is one tap away under it. Without an
// enrollment there is nothing to lead with, so the card shows straight away.
export default function LockScreen({ touchID, biometry = 'touch' }: Props) {
  const { t } = useTranslation()
  const { mascot, eyebrow, field, submit, biometric, change } = useUnlock()
  // Derived, not seeded: `touchID` only becomes true once the launch probe
  // (`isBiometricAvailable`) answers, which is after this mounts — a card
  // seeded from the first render would never give way to the tile.
  const [revealed, setRevealed] = useState(false)
  const password = revealed || !touchID

  // ...but that probe can also land *between* two keystrokes, and swapping the
  // card for the tile then would throw away a passphrase already being typed.
  // So any use of the card is itself a decision to keep it, whatever the probe
  // says afterwards.
  const keep = () => setRevealed(true)

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
            biometry={biometry}
            testid="unlock-password-input"
            invalid={field.invalid}
            success={field.success}
            pending={field.pending}
            disabled={field.disabled}
            onChange={event => {
              keep()
              change(event)
            }}
            onEnter={value => {
              keep()
              submit(value)
            }}
            onTouchID={biometric}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex justify-center">
            <BiometricTile biometry={biometry} onUnlock={biometric} />
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
