import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { BiometricMode } from '@/api/types'
import { enableBiometric, disableBiometric } from '@/api/auth'
import { describeError } from '@/api/errors'
import { useApp, refreshApp } from '@/store'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'

// What the gate actually is, once we know it. Before enrollment we can only
// describe the offer; afterwards the recorded mode says which guarantee holds.
const description = (t: TFunction, mode: BiometricMode | null) => {
  if (mode === 'protected')
    return t(
      'Your vault key is protected by the Secure Enclave and invalidated if your fingerprints change.'
    )
  if (mode === 'prompt')
    return t(
      'Your vault key is stored in your OS credential store and released after a biometric check.'
    )
  return t(
    'Store your vault key in the OS secure store, released only after a biometric check.'
  )
}

export default function BiometricRow() {
  const { t } = useTranslation()
  // The launch probe owns both halves of this row; the failure is ours alone.
  const biometric = useApp(state => state.status?.biometric)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One enrollment opens every workspace, and it stores the primary's key — so
  // a workspace opened on its own password, with the primary still closed this
  // session, has nothing to enrol with yet. The probe says so (`canEnroll`),
  // and the switch waits rather than offering a press that would be refused.
  const enrollable = !!biometric?.available || !!biometric?.canEnroll

  const toggle = () => {
    setBusy(true)
    setError(null)
    const op = biometric?.available ? disableBiometric() : enableBiometric()
    op.catch((err: unknown) => setError(describeError(err)))
      // Whichever way it went, the row is redrawn from a fresh probe rather
      // than from a guess: an unentitled build settles on a different mode
      // than it was offered, and a refusal changes nothing at all.
      .finally(() => refreshApp().finally(() => setBusy(false)))
  }

  return (
    <SettingsGroup label={t('Biometrics')}>
      <SettingsRow
        label={t('Unlock with Touch ID or Windows Hello')}
        description={description(t, biometric?.available ? biometric.mode : null)}
        control={
          <Toggle
            name="biometric"
            checked={!!biometric?.available}
            disabled={busy || !enrollable}
            onChange={toggle}
            aria-label={t('Unlock with Touch ID or Windows Hello')}
            testid="settings-biometric-toggle"
          />
        }
      >
        {error && (
          <span data-testid="settings-biometric-error" className="text-base text-bad">
            {error}
          </span>
        )}
      </SettingsRow>
    </SettingsGroup>
  )
}
