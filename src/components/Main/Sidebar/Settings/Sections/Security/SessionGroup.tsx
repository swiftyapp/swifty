import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useStore, updateSettings } from '@/store'
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
const clipboardOptions = (t: TFunction) => [
  { value: '15000', label: '15 s' },
  { value: '30000', label: '30 s' },
  { value: '60000', label: '60 s' },
  { value: '0', label: t('Never') }
]

export default function SessionGroup() {
  const { t } = useTranslation()
  const lock = useStore(state => String(state.settings.autolockSecs))
  const clipboard = useStore(state => String(state.settings.clipboardTimeoutMs))

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
            name={lockLabel}
            options={LOCK_OPTIONS}
            value={lock}
            onChange={value => updateSettings({ autolockSecs: Number(value) })}
            testidPrefix="settings-autolock"
          />
        }
      />
      <SettingsRow
        label={clipboardLabel}
        description={t('Copied secrets are wiped after this delay')}
        control={
          <Segmented
            name={clipboardLabel}
            options={clipboardOptions(t)}
            value={clipboard}
            onChange={value => updateSettings({ clipboardTimeoutMs: Number(value) })}
            testidPrefix="settings-clipboard"
          />
        }
      />
    </SettingsGroup>
  )
}
