import { useRef, useState } from 'react'
import { cx } from '@/utils/cx'
import { ChevronDownGlyph } from '@/components/Main/icons'
import { Dropdown, DropdownCheck, DropdownItem } from './Dropdown'
import { META } from './tokens'

interface Option<T extends string> {
  value: T
  label: string
  // Grey, on the right of the label: a locale code, a pattern.
  meta?: string
}

interface Props<T extends string> {
  // The accessible name; the trigger reads as "<label>: <current option>".
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  // `<prefix>-trigger` on the trigger, `<prefix>-<value>` on each item.
  testidPrefix?: string
  // On the phone layout the menu opens above the trigger when there is more
  // room above it than below.
  upOnCompact?: boolean
}

// A single choice from a field-shaped trigger naming the current option, opening
// a menu of all of them. For options too many or too wide to sit side by side.
export default function MenuSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  testidPrefix,
  upOnCompact
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const current = options.find(option => option.value === value)

  const toggle = () => {
    if (!open && upOnCompact && trigger.current) {
      const { top, bottom } = trigger.current.getBoundingClientRect()
      setUp(top > window.innerHeight - bottom)
    }
    setOpen(!open)
  }

  const pick = (next: T) => {
    setOpen(false)
    trigger.current?.focus()
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        data-testid={testidPrefix && `${testidPrefix}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? value}`}
        onClick={toggle}
        className="flex h-9 w-[236px] max-w-full cursor-pointer items-center gap-2 rounded-sm border border-line2 bg-field px-3 text-base font-medium text-text transition-colors hover:border-accent-line"
      >
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? value}</span>
        {current?.meta && <span className={META}>{current.meta}</span>}
        <ChevronDownGlyph className="flex-none text-text2" />
      </button>
      {open && (
        <Dropdown
          onBlur={() => setOpen(false)}
          className={cx(
            'right-0 top-10 w-[260px]',
            up && 'max-md:top-auto max-md:bottom-10 max-md:origin-bottom'
          )}
          listClassName={upOnCompact ? 'max-md:max-h-[35vh]' : undefined}
        >
          {options.map(option => (
            <DropdownItem
              key={option.value}
              checked={option.value === value}
              testid={testidPrefix && `${testidPrefix}-${option.value}`}
              onClick={() => pick(option.value)}
            >
              <span className="min-w-0 flex-1 truncate text-text">{option.label}</span>
              {option.meta && <span className={META}>{option.meta}</span>}
              <DropdownCheck on={option.value === value} />
            </DropdownItem>
          ))}
        </Dropdown>
      )}
    </div>
  )
}
