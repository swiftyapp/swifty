import { useState, useEffect } from 'react'
import {
  isBiometricAvailable,
  enableBiometric,
  disableBiometric
} from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import Button from '@/components/elements/Button'
import { H1, Section as Row, LABEL, DESC, DANGER } from './ui'

interface Props {
  section: Section
}

export default function Biometric({ section }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    isBiometricAvailable()
      .then(setEnabled)
      .catch(() => setEnabled(false))
  }, [])

  const toggle = () => {
    setBusy(true)
    setError(null)
    const action = enabled ? disableBiometric() : enableBiometric()
    action
      .then(() => setEnabled(!enabled))
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
        <p className={DESC}>
          {t(
            'Store your vault key in the OS secure store, released only after a biometric check.'
          )}
        </p>
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
