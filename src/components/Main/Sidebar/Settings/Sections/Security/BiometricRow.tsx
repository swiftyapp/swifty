import { useState, useEffect } from 'react'
import {
  biometricStatus,
  enableBiometric,
  disableBiometric,
  type BiometricMode
} from '@/lib/commands'
import { t } from '@/i18n'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'

// What the gate actually is, once we know it. Before enrollment we can only
// describe the offer; afterwards the recorded mode says which guarantee holds.
const description = (mode: BiometricMode | null) => {
  if (mode === 'protected')
    return t(
      'Your vault key is protected by the Secure Enclave and invalidated if your fingerprints change.'
    )
  if (mode === 'prompt')
    return t(
      'Your vault key is stored in your OS credential store and released after a biometric check by Swifty.'
    )
  return t(
    'Store your vault key in the OS secure store, released only after a biometric check.'
  )
}

export default function BiometricRow() {
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<BiometricMode | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    biometricStatus()
      .then(({ enabled, mode }) => {
        setEnabled(enabled)
        setMode(mode)
      })
      .catch(() => setEnabled(false))
  }, [])

  const toggle = () => {
    setBusy(true)
    setError(null)
    const done = () => setBusy(false)
    if (enabled) {
      disableBiometric()
        .then(() => {
          setEnabled(false)
          setMode(null)
        })
        .catch(err => setError(String(err?.message ?? err)))
        .finally(done)
      return
    }
    enableBiometric()
      .then(next => {
        setEnabled(true)
        setMode(next)
      })
      .catch(err => setError(String(err?.message ?? err)))
      .finally(done)
  }

  return (
    <SettingsGroup label={t('Biometrics')}>
      <SettingsRow
        label={t('Unlock with Touch ID or Windows Hello')}
        description={description(enabled ? mode : null)}
        testid="settings-biometric-row"
        control={
          <Toggle
            name="biometric"
            checked={enabled}
            disabled={busy}
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
