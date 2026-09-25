import { useState } from 'react'
import { usePrefs, setPref, type SortMode } from '@/store'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { cx } from '@/utils/cx'
import { chord } from '@/lib/platform'
import IconButton from '@/components/elements/IconButton'
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownMeta
} from '@/components/elements/Dropdown'
import { SortGlyph, CheckGlyph } from '@/components/Main/icons'

// In the order the chords number them (⌘1–⌘3, see `useShortcuts`): the index
// first, then the two working orders.
const OPTIONS: { mode: SortMode; label: TKey }[] = [
  { mode: 'alpha', label: 'Name (A–Z)' },
  { mode: 'recent', label: 'Recently edited' },
  { mode: 'created', label: 'Date created' }
]

// The list header's sort affordance: a 32px tile that sits on the selection
// wash while its menu is open. The menu is right-anchored under it so it never
// runs off the list column's edge, captioned "Sort by", the chosen order
// checked in the leading slot and each order's chord at the row's end.
export default function SortMenu({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const sort = usePrefs(state => state.sort)

  const pick = (mode: SortMode) => {
    setPref('sort', mode)
    setOpen(false)
  }

  return (
    <div className="relative flex-none">
      <IconButton
        title={t('Sort')}
        active={open}
        activeTone="plain"
        expanded={open}
        testid="sort-menu"
        onClick={() => setOpen(value => !value)}
        className={cx('h-8 w-8', className)}
      >
        <SortGlyph size={16} stroke={1.8} />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[232px]">
          <Dropdown onBlur={() => setOpen(false)} className="w-full">
            <DropdownLabel>{t('Sort by')}</DropdownLabel>
            {OPTIONS.map((option, index) => (
              <DropdownItem
                key={option.mode}
                testid={`sort-option-${option.mode}`}
                checked={sort === option.mode}
                onClick={() => pick(option.mode)}
              >
                <span className="grid w-3.5 flex-none place-items-center">
                  {sort === option.mode && <CheckGlyph stroke={2} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t(option.label)}</span>
                {/* A finger has no ⌘, so no coarse pointer is shown one. */}
                <span aria-hidden className="any-pointer-coarse:hidden">
                  <DropdownMeta hint>{chord(String(index + 1))}</DropdownMeta>
                </span>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      )}
    </div>
  )
}
