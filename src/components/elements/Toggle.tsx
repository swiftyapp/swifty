import { cx } from '@/utils/cx'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  name?: string
  testid?: string
  'aria-label'?: string
}

// THE on/off control for settings rows: a 40x22 pill whose track carries the
// accent when on. A native `button role="switch"` handles Space/Enter and the
// global `:focus-visible` ring for free.
export default function Toggle({
  checked,
  onChange,
  disabled,
  name,
  testid,
  'aria-label': ariaLabel
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      name={name}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-testid={testid}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[22px] w-10 flex-none cursor-pointer rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line2',
        disabled && 'cursor-default opacity-50'
      )}
    >
      <span
        className={cx(
          'absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform',
          checked && 'translate-x-[18px]'
        )}
      />
    </button>
  )
}
