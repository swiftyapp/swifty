import { useState, useEffect } from 'react'
import { cx } from '@/utils/cx'
import {
  isBiometricAvailable,
  enableBiometric,
  disableBiometric
} from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'

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
      <h1>{t('Biometric Unlock')}</h1>
      <div className="section">
        <strong>{t('Unlock with Touch ID or Windows Hello')}</strong>
        <div>
          {t(
            'Store your vault key in the OS secure store, released only after a biometric check.'
          )}
        </div>
        <div
          className={cx('button', { danger: enabled, loading: busy })}
          onClick={busy ? undefined : toggle}
        >
          {enabled
            ? t('Disable Biometric Unlock')
            : t('Enable Biometric Unlock')}
        </div>
        {error && <span className="danger">{error}</span>}
      </div>
    </>
  )
}
