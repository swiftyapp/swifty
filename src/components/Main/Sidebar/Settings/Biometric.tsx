import { useState, useEffect } from 'react'
import {
  biometricStatus,
  enableBiometric,
  disableBiometric,
  type BiometricMode
} from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import Button from '@/components/elements/Button'
import { H1, Section as Row, LABEL, DESC, DANGER } from './ui'

interface Props {
  section: Section
}

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

export default function Biometric({ section }: Props) {
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
    if (enabled) {
      disableBiometric()
        .then(() => {
          setEnabled(false)
          setMode(null)
        })
        .catch(err => setError(String(err?.message ?? err)))
        .finally(() => setBusy(false))
      return
    }
    enableBiometric()
      .then(mode => {
        setEnabled(true)
        setMode(mode)
      })
      .catch(err => setError(String(err?.message ?? err)))
      .finally(() => setBusy(false))
  }

  if (section !== 'biometric') return null

  return (
    <>
      <h1 className={H1}>{t('Biometric Unlock')}</h1>
      <Row>
        <strong className={LABEL}>
          {t('Unlock with Touch ID or Windows Hello')}
        </strong>
        <p className={DESC}>{description(enabled ? mode : null)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={enabled ? 'danger' : 'primary'}
            loading={busy}
            onClick={toggle}
          >
            {enabled
              ? t('Disable Biometric Unlock')
              : t('Enable Biometric Unlock')}
          </Button>
          {error && <span className={DANGER}>{error}</span>}
        </div>
      </Row>
    </>
  )
}
