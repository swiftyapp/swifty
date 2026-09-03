import { useState } from 'react'
import type { GeneratorOptions } from '@/lib/commands'
import { getProps, setProps } from '@/defaults/generator'
import { LENGTH_RANGE } from '@/services/generator'
import { t } from '@/i18n'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'

// The seed values for every new password, shared with the ⌘G generator dialog.
// `uppercase` stays out of the UI — the dialog always draws from both cases —
// but is preserved in the stored props.
export default function GeneratorGroup() {
  const [options, setOptions] = useState<GeneratorOptions>(getProps())

  const update = (patch: Partial<GeneratorOptions>) => {
    const next = { ...options, ...patch }
    setProps(next)
    setOptions(next)
  }

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
            <span className="w-[68px] flex-none text-right font-mono text-xs text-text3">
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
