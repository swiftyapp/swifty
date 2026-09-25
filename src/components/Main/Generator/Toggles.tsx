import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { TKey } from '@/i18n'
import type { GeneratorSettings } from '@/services/generator'
import CharsetChips from './Charset'

type Flag = 'numbers' | 'excludeSimilar' | 'capitalize'

interface Toggle {
  flag: Flag
  label: TKey
}

// Only the switches that mean something in the active mode are offered: a word
// list has no character classes or look-alikes, and a random charset has no
// casing beyond its classes.
const RANDOM: Toggle[] = [{ flag: 'excludeSimilar', label: 'No look-alikes' }]

const MEMORABLE: Toggle[] = [
  { flag: 'capitalize', label: 'Capitalize' },
  { flag: 'numbers', label: 'Numbers' }
]

interface Props {
  settings: GeneratorSettings
  onChange: (patch: Partial<GeneratorSettings>) => void
}

export default function Toggles({ settings, onChange }: Props) {
  const { t } = useTranslation()
  const memorable = settings.mode === 'memorable'
  const toggles = memorable ? MEMORABLE : RANDOM

  return (
    <div className="mt-3.5 flex gap-1.5">
      {/* The classes first, as glyphs: the row is too tight for their names. */}
      {!memorable && (
        <CharsetChips
          settings={settings}
          onChange={onChange}
          compact
          size="lg"
          testidPrefix="generator-charset"
        />
      )}
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
