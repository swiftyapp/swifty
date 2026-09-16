import Masterpass from '@/components/elements/Masterpass'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Mascot from '@/components/elements/Mascot'
import type { BiometryType } from '@/api/types'
import { useUnlock } from './useUnlock'
import WorkspacePicker from './WorkspacePicker'

interface Props {
  /** Whether biometric unlock is enrolled *and* usable (see `appSlice`). */
  biometric: boolean
  /** Which gate the card's end segment names (see lib/biometry). */
  biometry?: BiometryType
}

// The wide lock screen: mascot, status line and the passphrase card, centered
// in the auth ground. Biometrics live inside the card as its end segment —
// there is a keyboard here, so typing is the lead affordance. The phone leads
// the other way round (see LockScreen); both run the same `useUnlock`.
export function Auth({ biometric, biometry = 'touch' }: Props) {
  const { mascot, eyebrow, field, submit, biometric: unlock, change } = useUnlock()

  return (
    <AuthShell footer>
      <div className="mb-7 flex justify-center">
        <Mascot state={mascot.state} gaze={mascot.gaze} />
      </div>
      <WorkspacePicker />
      <Eyebrow tone={eyebrow.tone} busy={eyebrow.busy} testid={eyebrow.testid}>
        {eyebrow.text}
      </Eyebrow>
      <div className="mt-8">
        <Masterpass
          variant="lock"
          biometric={biometric}
          biometry={biometry}
          testid="unlock-password-input"
          invalid={field.invalid}
          success={field.success}
          pending={field.pending}
          disabled={field.disabled}
          onChange={change}
          onEnter={submit}
          onBiometric={unlock}
        />
      </div>
    </AuthShell>
  )
}

export default Auth
