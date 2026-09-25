import { useTranslation } from 'react-i18next'
import { usePrefs, setPref, DATE_FORMATS } from '@/store'
import { dates } from '@/utils/time'
import { useNow } from '@/hooks/useNow'
import { cx } from '@/utils/cx'
import SettingsRow from '@/components/elements/SettingsRow'
import Segmented from '@/components/elements/Segmented'
import AccentSwatches from '@/components/elements/AccentSwatches'
import { CARD, LABEL } from '@/components/elements/tokens'
import { CalendarGlyph, GlobeGlyph, PaletteGlyph } from '@/components/Main/icons'
import ThemePicker from './General/ThemePicker'
import LanguageMenu from './General/LanguageMenu'

// The language menu hangs out of its card, so this one card lets it: its rows
// paint no ground of their own, so nothing needs the corner clip.
const MENU_CARD = CARD.replace('overflow-hidden', 'overflow-visible')

// The General section (key `language`): appearance, then language & region.
export default function Language() {
  const { t } = useTranslation()
  const accent = usePrefs(state => state.accent)
  const format = usePrefs(state => state.dateFormat)

  // Each row label doubles as its radiogroup's accessible name.
  const formatLabel = t('Date format')
  const accentLabel = t('Accent')

  // Each pattern shown as what it makes of today, rather than as its letters.
  // Re-read each minute so the labels roll over at midnight.
  const today = useNow(60_000)
  const formats = DATE_FORMATS.map(value => ({
    value,
    label: dates(value).shortDate(today)
  }))

  return (
    <>
      <section className="mb-7">
        <div className={cx(LABEL, 'mb-2')}>{t('Appearance')}</div>
        <ThemePicker />
        <div className={cx(CARD, 'mt-3')}>
          <SettingsRow
            label={accentLabel}
            icon={<PaletteGlyph />}
            control={
              <AccentSwatches
                name={accentLabel}
                value={accent}
                onChange={next => setPref('accent', next)}
                testidPrefix="settings-accent"
              />
            }
          />
        </div>
      </section>

      <section className="mb-7">
        <div className={cx(LABEL, 'mb-2')}>{t('Language & region')}</div>
        <div className={MENU_CARD}>
          <SettingsRow
            label={t('Language')}
            description={t('Menus, dialogs and autofill prompts. Applies instantly.')}
            icon={<GlobeGlyph />}
            control={<LanguageMenu />}
          />
          <SettingsRow
            label={formatLabel}
            description={t('Used in item history, expiry dates and audits')}
            icon={<CalendarGlyph />}
            control={
              <Segmented
                name={formatLabel}
                options={formats}
                value={format}
                onChange={next => setPref('dateFormat', next)}
                testidPrefix="settings-date-format"
              />
            }
          />
        </div>
      </section>
    </>
  )
}
