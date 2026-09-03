import { cx } from '@/utils/cx'
import { useRadioNav } from '@/hooks/useRadioNav'

interface Props<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  // Mono labels, for numeric/unit values like "10 m".
  mono?: boolean
  // Names the radiogroup for screen readers — usually the row's own label,
  // which is otherwise only visually associated with the control.
  name?: string
  testidPrefix?: string
  className?: string
}

// THE two-to-four-way switch (generator mode, timeout, theme): a hairline
// trough with the active segment in the accent wash. Labels arrive already
// translated.
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  mono,
  name,
  testidPrefix,
  className
}: Props<T>) {
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
      className={cx('flex gap-0.5 rounded-sm border border-line2 p-0.5', className)}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-testid={testidPrefix && `${testidPrefix}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cx(
              'cursor-pointer rounded-sm px-2.5 py-[3px] text-base transition-colors',
              mono && 'font-mono',
              active ? 'bg-accent-soft text-text' : 'text-text3 hover:text-text'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
