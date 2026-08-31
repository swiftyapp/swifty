import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import type { GeneratorSettings } from '@/services/generator'

type Flag = 'symbols' | 'numbers' | 'excludeSimilar' | 'capitalize'

interface Toggle {
  flag: Flag
  label: string
}

// Only the switches that mean something in the active mode are offered: symbols
// and look-alikes have no bearing on a word list, and casing has none on a
// random charset.
const RANDOM: Toggle[] = [
  { flag: 'symbols', label: 'Symbols' },
  { flag: 'numbers', label: 'Numbers' },
  { flag: 'excludeSimilar', label: 'No look-alikes' }
]

const MEMORABLE: Toggle[] = [
  { flag: 'capitalize', label: 'Capitalize' },
  { flag: 'numbers', label: 'Numbers' }
]

interface Props {
  settings: GeneratorSettings
  onChange: (patch: Partial<GeneratorSettings>) => void
}

export default function Toggles({ settings, onChange }: Props) {
  const toggles = settings.mode === 'memorable' ? MEMORABLE : RANDOM

  return (
    <div className="mt-3.5 flex gap-1.5">
      {toggles.map(({ flag, label }) => {
        const active = settings[flag]
        return (
          <button
            key={flag}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange({ [flag]: !active } as Partial<GeneratorSettings>)
            }
            className={cx(
              'grid h-9 flex-1 cursor-pointer place-items-center rounded-sm border text-base transition-colors',
              active
                ? 'border-accent-line bg-accent-soft text-accent'
                : 'border-line2 text-text2 hover:border-accent-line hover:text-text'
            )}
          >
            {t(label)}
          </button>
        )
      })}
    </div>
  )
}
