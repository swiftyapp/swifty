import Masterpass from '@/components/elements/Masterpass'
import Controls from '@/components/elements/Controls'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'
import type { BiometryType } from '@/lib/commands'
import { useUnlock } from './useUnlock'

interface Props {
  touchID: boolean
  /** Which gate the card's end segment names (see lib/biometry). */
  biometry?: BiometryType
}

// The wide lock screen: mascot, status line and the passphrase card, centered
// in the auth ground. Biometrics live inside the card as its end segment —
// there is a keyboard here, so typing is the lead affordance. The phone leads
// the other way round (see LockScreen); both run the same `useUnlock`.
export function Auth({ touchID, biometry = 'touch' }: Props) {
  const { mascot, eyebrow, field, submit, biometric, change } = useUnlock()

  return (
    <>
      <Controls />
      <AuthShell>
        <div className="mb-7 flex justify-center">
          <Mascot state={mascot.state} gaze={mascot.gaze} />
        </div>
        <Eyebrow tone={eyebrow.tone} busy={eyebrow.busy} testid={eyebrow.testid}>
          {eyebrow.text}
        </Eyebrow>
        <div className="mt-8">
          <Masterpass
            variant="lock"
            touchID={touchID}
            biometry={biometry}
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
      </AuthShell>
    </>
  )
}

export default Auth
