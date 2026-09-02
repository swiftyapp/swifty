import { useState } from 'react'
import { useStore, localeChanged, changeTheme } from '@/store'
import { LANGUAGES, t } from '@/i18n'
import { getFormat, setFormat, DATE_FORMATS, type DateFormat } from '@/defaults/dateFormat'
import type { ThemePreference } from '@/theme'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Segmented from '@/components/elements/Segmented'
import RadioList from '@/components/elements/RadioList'
import { MONO_LABEL } from '@/components/elements/tokens'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export default function Language() {
  const locale = useStore(state => state.i18n.locale)
  const theme = useStore(state => state.theme)
  const [format, setDateFormat] = useState<DateFormat>(getFormat())

  const onFormat = (next: DateFormat) => {
    setDateFormat(next)
    setFormat(next)
  }

  return (
    <>
      <section className="mb-7">
        <div className={`${MONO_LABEL} mb-2`}>{t('Language')}</div>
        <RadioList
          name="locale"
          value={locale}
          onChange={localeChanged}
          testidPrefix="settings-locale"
          options={Object.keys(LANGUAGES).map(key => ({
            value: key,
            label: LANGUAGES[key],
            meta: key
          }))}
        />
      </section>

      <SettingsGroup label={t('Formats')}>
        <SettingsRow
          label={t('Date format')}
          testid="settings-date-format-row"
          control={
            <Segmented
              mono
              options={DATE_FORMATS.map(value => ({ value, label: value }))}
              value={format}
              onChange={onFormat}
              testidPrefix="settings-date-format"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label={t('Appearance')}>
        <SettingsRow
          label={t('Theme')}
          testid="settings-theme-row"
          control={
            <Segmented
              options={THEMES.map(option => ({ ...option, label: t(option.label) }))}
              value={theme}
              onChange={changeTheme}
              testidPrefix="settings-theme"
            />
          }
        />
      </SettingsGroup>
    </>
  )
}
