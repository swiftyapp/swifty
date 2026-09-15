import { useTranslation } from 'react-i18next'
import type { GeneratorDefaults } from '@/api/app'
import { useStore, updateSettings } from '@/store'
import { LENGTH_RANGE } from '@/services/generator'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'
import { META } from '@/components/elements/tokens'

// The seed values for every new password, shared with the ⌘G generator dialog.
// Read from the store rather than copied into state on mount, so a change the
// dialog persisted shows up here instead of leaving the rows stale.
// `uppercase` stays out of the UI — the dialog always draws from both cases —
// but is preserved in the stored defaults.
export default function GeneratorGroup() {
  const { t } = useTranslation()
  const options = useStore(state => state.settings.generator)

  const update = (patch: Partial<GeneratorDefaults>) =>
    updateSettings({ generator: { ...options, ...patch } })

  return (
    <SettingsGroup label={t('Generator defaults')}>
      <SettingsRow
        label={t('Length')}
        control={
          <div className="flex w-[280px] items-center gap-3">
            <input
              type="range"
              name="length"
              min={LENGTH_RANGE.min}
              max={LENGTH_RANGE.max}
              className="h-1.5 flex-1 accent-accent"
              value={options.length}
              data-testid="settings-generator-length"
              onChange={e => update({ length: Number(e.target.value) })}
            />
            <span className={`w-[68px] flex-none text-right ${META}`}>
              {options.length} {t('chars')}
            </span>
          </div>
        }
      />
      <SettingsRow
        label={t('Include symbols')}
        control={
          <Toggle
            name="symbols"
            checked={options.symbols}
            onChange={symbols => update({ symbols })}
            aria-label={t('Include symbols')}
            testid="settings-generator-symbols"
          />
        }
      />
      <SettingsRow
        label={t('Include numbers')}
        control={
          <Toggle
            name="numbers"
            checked={options.numbers}
            onChange={numbers => update({ numbers })}
            aria-label={t('Include numbers')}
            testid="settings-generator-numbers"
          />
        }
      />
    </SettingsGroup>
  )
}
