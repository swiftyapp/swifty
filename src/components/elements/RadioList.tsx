import { cx } from '@/utils/cx'
import { useRadioNav } from '@/hooks/useRadioNav'
import { CARD, ROW_HAIRLINE } from './tokens'

interface Props {
  options: { value: string; label: string; meta?: string }[]
  value: string
  onChange: (value: string) => void
  name?: string
  testidPrefix?: string
}

// A single-choice list on the card surface — the long-form alternative to
// Segmented, when options need room or a mono value on the right (languages,
// timeouts, sort orders).
export default function RadioList({
  options,
  value,
  onChange,
  name,
  testidPrefix
}: Props) {
  const nav = useRadioNav(
    options.map(option => option.value),
    value,
    onChange
  )

  return (
    <div
      ref={nav.ref}
      role="radiogroup"
      aria-label={name}
      onKeyDown={nav.onKeyDown}
      className={CARD}
    >
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={testidPrefix && `${testidPrefix}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover',
              ROW_HAIRLINE
            )}
          >
            <span
              className={cx(
                'grid h-4 w-4 flex-none place-items-center rounded-full border transition-colors',
                selected ? 'border-accent' : 'border-line2'
              )}
            >
              {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-base text-text">{option.label}</span>
            {option.meta && (
              <span className="flex-none font-mono text-xs text-text3">{option.meta}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
