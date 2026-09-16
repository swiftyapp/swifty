import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Button from '@/components/elements/Button'
import BiometryGlyph from '@/components/elements/BiometryGlyph'
import { META_TYPE } from '@/components/elements/tokens'
import type { BiometryType } from '@/api/types'
import { enableBiometric } from '@/api/auth'
import { biometryLabel } from '@/lib/biometry'
import StepHeader from '../shared/StepHeader'
import { ACTIONS, FOOTNOTE } from '../shared/layout'
import { describeError } from '@/api/errors'

interface Props {
  /** Which gate this device has, so the screen uses the OS's own word for it. */
  biometry: BiometryType
  /** Into the app, enrolled or not. The session is already open either way. */
  onDone: () => void
}

// The last question, asked once, while the session that can answer it is open:
// enrolling stores the key the unlock just derived, so it can only happen here
// or in Settings — never from a locked app.
export default function Biometric({ biometry, onDone }: Props) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const name = t(biometryLabel(biometry))

  const enable = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    enableBiometric()
      .then(onDone)
      .catch((err: unknown) => {
        setBusy(false)
        // "Not now" is still right there, so a failed enrollment is a note
        // rather than a dead end.
        setError(describeError(err) || t('Could not enable {{name}}', { name }))
      })
  }

  return (
    <AuthShell>
      <div className="mb-7 flex justify-center">
        <span className="grid h-16 w-16 place-items-center rounded-xl bg-tile text-touchid">
          <BiometryGlyph type={biometry} size={30} />
        </span>
      </div>

      <StepHeader
        eyebrow={t('One last thing')}
        title={t('Unlock with {{name}}?', { name })}
        body={t(
          'Skip the master password for everyday unlocks. You can change this any time in Settings.'
        )}
      />

      <div className={ACTIONS}>
        <Button block testid="setup-enable-biometric-button" loading={busy} onClick={enable}>
          {t('Enable {{name}}', { name })}
        </Button>
        <Button block variant="pale" testid="setup-skip-biometric-button" onClick={onDone}>
          {t('Not now')}
        </Button>
      </div>

      {error && (
        <p data-testid="setup-biometric-error" className={`${FOOTNOTE} ${META_TYPE} text-bad`}>
          {error}
        </p>
      )}
    </AuthShell>
  )
}
