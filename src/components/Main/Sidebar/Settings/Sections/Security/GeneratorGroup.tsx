import { useTranslation } from 'react-i18next'
import { LENGTH_RANGE } from '@/services/generator'
import { useGenerator } from '@/components/Main/Generator/useGenerator'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import CharsetChips from '@/components/Main/Generator/Charset'
import { META } from '@/components/elements/tokens'
import Sample from './Sample'

// The seed values for every new password, shared with the ⌘G generator dialog
// through the same hook: it starts from the stored defaults, writes each change
// back to them, and draws a fresh sample on every change.
export default function GeneratorGroup() {
  const { t } = useTranslation()
  const { settings, value, update, regenerate, bits, level } = useGenerator()

  return (
    <SettingsGroup label={t('Generator defaults')}>
      <Sample value={value} bits={bits} level={level} onRegenerate={regenerate} />
      <SettingsRow
        label={t('Length')}
        control={
          <div className="flex w-[280px] items-center gap-3">
            <input
              type="range"
              name="length"
              aria-label={t('Length')}
              min={LENGTH_RANGE.min}
              max={LENGTH_RANGE.max}
              className="h-1.5 flex-1 accent-accent"
              value={settings.length}
              data-testid="settings-generator-length"
              onChange={e => update({ length: Number(e.target.value) })}
            />
            <span className={`w-[68px] flex-none text-right ${META}`}>
              {settings.length} {t('chars')}
            </span>
          </div>
        }
      />
      <SettingsRow
        label={t('Characters')}
        control={
          <CharsetChips settings={settings} onChange={update} testidPrefix="settings-generator" />
        }
      />
    </SettingsGroup>
  )
}
