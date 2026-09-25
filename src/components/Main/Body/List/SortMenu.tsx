import { useState } from 'react'
import { usePrefs, setPref, SORT_MODES, type SortMode } from '@/store'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { chord } from '@/lib/platform'
import IconButton from '@/components/elements/IconButton'
import {
  Dropdown,
  DropdownCheck,
  DropdownItem,
  DropdownLabel,
  DropdownMeta
} from '@/components/elements/Dropdown'
import { SortGlyph } from '@/components/Main/icons'

const LABELS: Record<SortMode, TKey> = {
  alpha: 'Name (A–Z)',
  recent: 'Recently edited',
  created: 'Date created'
}

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
        size={32}
        expanded={open}
        testid="sort-menu"
        onClick={() => setOpen(value => !value)}
        className={className}
      >
        <SortGlyph size={16} stroke={1.8} />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[232px]">
          <Dropdown onBlur={() => setOpen(false)} className="w-full">
            <DropdownLabel>{t('Sort by')}</DropdownLabel>
            {SORT_MODES.map((mode, index) => (
              <DropdownItem
                key={mode}
                testid={`sort-option-${mode}`}
                checked={sort === mode}
                onClick={() => pick(mode)}
              >
                <DropdownCheck on={sort === mode} />
                <span className="min-w-0 flex-1 truncate">{t(LABELS[mode])}</span>
                <DropdownMeta hint>{chord(String(index + 1))}</DropdownMeta>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      )}
    </div>
  )
}
