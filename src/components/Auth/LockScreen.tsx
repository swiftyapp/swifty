import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Masterpass from '@/components/elements/Masterpass'
import type { BiometryType } from '@/api/types'
import BiometricTile from './BiometricTile'
import Brand from './Brand'
import { useUnlock } from './useUnlock'
import WorkspacePicker from './WorkspacePicker'

interface Props {
  /** Whether biometric unlock is enrolled *and* usable (see `appSlice`). */
  biometric: boolean
  /** Which gate the tile and the card's end segment name (see lib/biometry). */
  biometry?: BiometryType
}

// The phone lock screen. Same parts as the wide one and the same `useUnlock`,
// ordered for a thumb instead of a keyboard: the biometric tile leads when a
// key is enrolled and the passphrase card is one tap away under it. Without an
// enrollment there is nothing to lead with, so the card shows straight away.
export default function LockScreen({ biometric, biometry = 'touch' }: Props) {
  const { t } = useTranslation()
  const { mascot, eyebrow, field, submit, biometric: unlock, change } = useUnlock()
  // Derived, not seeded: `biometric` only becomes true once the launch probe
  // answers, which is after this mounts — a card seeded from the first render
  // would never give way to the tile.
  const [revealed, setRevealed] = useState(false)
  const password = revealed || !biometric

  // ...but that probe can also land *between* two keystrokes, and swapping the
  // card for the tile then would throw away a passphrase already being typed.
  // So any use of the card is itself a decision to keep it, whatever the probe
  // says afterwards.
  const keep = () => setRevealed(true)

  return (
    <AuthShell footer>
      <Brand state={mascot.state} gaze={mascot.gaze} />
      <WorkspacePicker busy={field.pending || field.success} />
      <Eyebrow tone={eyebrow.tone} busy={eyebrow.busy} testid={eyebrow.testid}>
        {eyebrow.text}
      </Eyebrow>

      {password ? (
        <div className="mx-auto mt-8 max-w-[380px]">
          {/* The card keeps its own biometric segment, so revealing the
              passphrase never takes the faster way out away. */}
          <Masterpass
            key={field.vault}
            biometric={biometric}
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
            onBiometric={unlock}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex justify-center">
            <BiometricTile biometry={biometry} onUnlock={unlock} />
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
