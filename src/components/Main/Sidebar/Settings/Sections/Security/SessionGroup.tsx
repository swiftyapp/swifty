import { useState } from 'react'
import { setAutolockTimeout } from '@/lib/commands'
import { getSecs, setSecs } from '@/defaults/autolock'
import { getTimeout, setTimeout as setClipboardTimeout } from '@/defaults/clipboard'
import { t } from '@/i18n'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Segmented from '@/components/elements/Segmented'

const LOCK_OPTIONS = [
  { value: '60', label: '1 m' },
  { value: '300', label: '5 m' },
  { value: '900', label: '15 m' },
  { value: '1800', label: '30 m' },
  { value: '3600', label: '1 h' }
]

// Built per render so a locale switch retranslates. The unit values read the
// same in every locale; only `Never` is words.
const clipboardOptions = () => [
  { value: '15000', label: '15 s' },
  { value: '30000', label: '30 s' },
  { value: '60000', label: '60 s' },
  { value: '0', label: t('Never') }
]

export default function SessionGroup() {
  const [lock, setLock] = useState(String(getSecs()))
  const [clipboard, setClipboard] = useState(String(getTimeout()))

  const onLock = (value: string) => {
    setLock(value)
    setSecs(Number(value))
    setAutolockTimeout(Number(value)).catch(() => {})
  }

  const onClipboard = (value: string) => {
    setClipboard(value)
    setClipboardTimeout(Number(value))
  }

  // The row label doubles as the radiogroup's accessible name.
  const lockLabel = t('Lock vault after')
  const clipboardLabel = t('Clear clipboard')

  return (
    <SettingsGroup label={t('Session')}>
      <SettingsRow
        label={lockLabel}
        description={t('Idle time before the vault seals itself')}
        control={
          <Segmented
            mono
            name={lockLabel}
            options={LOCK_OPTIONS}
            value={lock}
            onChange={onLock}
            testidPrefix="settings-autolock"
          />
        }
      />
      <SettingsRow
        label={clipboardLabel}
        description={t('Copied secrets are wiped after this delay')}
        control={
          <Segmented
            mono
            name={clipboardLabel}
            options={clipboardOptions()}
            value={clipboard}
            onChange={onClipboard}
            testidPrefix="settings-clipboard"
          />
        }
      />
    </SettingsGroup>
  )
}
