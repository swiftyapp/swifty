import { t } from '@/i18n'
import {
  LENGTH_RANGE,
  WORDS_RANGE,
  type GeneratorSettings
} from '@/services/generator'

interface Props {
  settings: GeneratorSettings
  onChange: (patch: Partial<GeneratorSettings>) => void
}

// One slider row that measures characters in random mode and words in
// memorable mode — the only dimension that changes between the two.
export default function Amount({ settings, onChange }: Props) {
  const byWords = settings.mode === 'memorable'
  const { min, max } = byWords ? WORDS_RANGE : LENGTH_RANGE
  const value = byWords ? settings.words : settings.length

  return (
    <div className="mt-5 flex items-center gap-3.5">
      <span className="w-[66px] flex-none font-mono text-xs uppercase tracking-label text-text3">
        {t(byWords ? 'Words' : 'Length')}
      </span>
      <input
        type="range"
        aria-label={t(byWords ? 'Words' : 'Length')}
        data-testid="generator-amount"
        min={min}
        max={max}
        value={value}
        onChange={event => {
          const next = Number(event.target.value)
          onChange(byWords ? { words: next } : { length: next })
        }}
        className="h-1.5 flex-1 accent-accent"
      />
      <span className="w-[58px] flex-none text-right font-mono text-base text-text2">
        {value} {t(byWords ? 'words' : 'chars')}
      </span>
    </div>
  )
}
