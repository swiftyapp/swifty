import { useState } from 'react'
import { cx } from '@/utils/cx'
import { ChevronDownGlyph } from '@/components/Main/icons'
import { Dropdown, DropdownCheck, DropdownItem } from './Dropdown'
import { META } from './tokens'

export interface MenuSelectOption<T extends string = string> {
  value: T
  label: string
  // Grey, on the right of the label: a locale code, a pattern.
  meta?: string
}

interface Props<T extends string> {
  // The accessible name; the trigger reads as "<label>: <current option>".
  label: string
  options: MenuSelectOption<T>[]
  value: T
  onChange: (value: T) => void
  // `<prefix>-trigger` on the trigger, `<prefix>-<value>` on each item.
  testidPrefix?: string
  // On the phone layout the menu opens above the trigger instead of below it.
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
  const current = options.find(option => option.value === value)

  const pick = (next: T) => {
    setOpen(false)
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={testidPrefix && `${testidPrefix}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? value}`}
        onClick={() => setOpen(state => !state)}
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
            upOnCompact && 'max-md:top-auto max-md:bottom-10 max-md:origin-bottom'
          )}
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
