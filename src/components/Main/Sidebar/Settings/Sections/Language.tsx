import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, changeTheme } from '@/store'
import { LANGUAGES, type TKey } from '@/i18n'
import { getFormat, setFormat, DATE_FORMATS, type DateFormat } from '@/defaults/dateFormat'
import type { ThemePreference } from '@/theme'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Segmented from '@/components/elements/Segmented'
import RadioList from '@/components/elements/RadioList'
import { MONO_LABEL } from '@/components/elements/tokens'

const THEMES: { value: ThemePreference; label: TKey }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export default function Language() {
  const { t, i18n } = useTranslation()
  const theme = useStore(state => state.theme)
  const [format, setDateFormat] = useState<DateFormat>(getFormat())

  const onFormat = (next: DateFormat) => {
    setDateFormat(next)
    setFormat(next)
  }

  // Each row label doubles as its radiogroup's accessible name.
  const formatLabel = t('Date format')
  const themeLabel = t('Theme')

  return (
    <>
      <section className="mb-7">
        <div className={`${MONO_LABEL} mb-2`}>{t('Language')}</div>
        <RadioList
          name="locale"
          value={i18n.resolvedLanguage ?? ''}
          onChange={locale => void i18n.changeLanguage(locale)}
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
          label={formatLabel}
          control={
            <Segmented
              mono
              name={formatLabel}
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
          label={themeLabel}
          control={
            <Segmented
              name={themeLabel}
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
