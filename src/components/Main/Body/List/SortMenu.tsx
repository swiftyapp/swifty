import { useState } from 'react'
import { useStore, setSort } from '@/store'
import type { SortMode } from '@/defaults/list'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { SortGlyph, CheckGlyph } from '@/components/Main/icons'

const OPTIONS: { mode: SortMode; label: TKey }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'alpha', label: 'Alphabetical' }
]

// The list header's sort affordance. The menu is right-anchored under the
// button so it never runs off the list column's edge.
export default function SortMenu() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const sort = useStore(state => state.sort)

  const pick = (mode: SortMode) => {
    setSort(mode)
    setOpen(false)
  }

  return (
    <div className="relative flex-none">
      <IconButton
        title={t('Sort')}
        active={open}
        expanded={open}
        testid="sort-menu"
        onClick={() => setOpen(value => !value)}
      >
        <SortGlyph />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[180px]">
          <Dropdown onBlur={() => setOpen(false)}>
            {OPTIONS.map(option => (
              <DropdownItem
                key={option.mode}
                testid={`sort-option-${option.mode}`}
                onClick={() => pick(option.mode)}
              >
                <span className="grid w-3.5 flex-none place-items-center text-accent">
                  {sort === option.mode && <CheckGlyph />}
                </span>
                {t(option.label)}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      )}
    </div>
  )
}
