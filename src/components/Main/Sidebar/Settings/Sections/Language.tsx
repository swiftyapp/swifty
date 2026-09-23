import { useTranslation } from 'react-i18next'
import { usePrefs, setPref, DATE_FORMATS } from '@/store'
import { LANGUAGES, type TKey } from '@/i18n'
import type { ThemePreference } from '@/theme'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Segmented from '@/components/elements/Segmented'
import RadioList from '@/components/elements/RadioList'
import AccentSwatches from '@/components/elements/AccentSwatches'
import { LABEL } from '@/components/elements/tokens'

const THEMES: { value: ThemePreference; label: TKey }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export default function Language() {
  const { t, i18n } = useTranslation()
  const theme = usePrefs(state => state.theme)
  const accent = usePrefs(state => state.accent)
  const format = usePrefs(state => state.dateFormat)

  // Each row label doubles as its radiogroup's accessible name.
  const formatLabel = t('Date format')
  const themeLabel = t('Theme')
  const accentLabel = t('Accent')

  return (
    <>
      <section className="mb-7">
        <div className={`${LABEL} mb-2`}>{t('Language')}</div>
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
              name={formatLabel}
              options={DATE_FORMATS.map(value => ({ value, label: value }))}
              value={format}
              onChange={next => setPref('dateFormat', next)}
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
              onChange={next => setPref('theme', next)}
              testidPrefix="settings-theme"
            />
          }
        />
        <SettingsRow
          label={accentLabel}
          control={
            <AccentSwatches
              name={accentLabel}
              value={accent}
              onChange={next => setPref('accent', next)}
              testidPrefix="settings-accent"
            />
          }
        />
      </SettingsGroup>
    </>
  )
}
