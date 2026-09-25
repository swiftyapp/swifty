import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryType } from '@/api/types'
import { useUi, useVault, setFilterType } from '@/store'
import { KINDS } from '@/kinds'
import {
  Dropdown,
  DropdownCheck,
  DropdownGlyph,
  DropdownItem,
  DropdownLabel,
  DropdownMeta,
  DropdownSeparator
} from '@/components/elements/Dropdown'
import { GridRailGlyph } from '../../icons'

export default function ScopeMenu({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const open = useUi(state => state.filterType)
  const items = useVault(state => state.items)
  const counts = useMemo(() => {
    const totals = new Map<EntryType, number>()
    for (const item of items) totals.set(item.type, (totals.get(item.type) ?? 0) + 1)
    return totals
  }, [items])

  const pick = (type: EntryType | null) => {
    setFilterType(type)
    onClose()
  }

  return (
    <div className="absolute left-0 top-full z-20 mt-1.5 w-[256px]">
      <Dropdown onBlur={onClose} className="w-full" listClassName="max-h-[360px]">
        <DropdownItem testid="scope-option-all" checked={open === null} onClick={() => pick(null)}>
          <DropdownGlyph>
            <GridRailGlyph size={16} stroke={1.7} />
          </DropdownGlyph>
          <span className="min-w-0 flex-1 truncate font-medium">{t('All Items')}</span>
          <DropdownMeta testid="scope-option-all-count">{items.length}</DropdownMeta>
          <DropdownCheck on={open === null} />
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>{t('Kinds')}</DropdownLabel>
        {KINDS.map(kind => {
          const count = counts.get(kind.type) ?? 0
          const current = kind.type === open
          return (
            <DropdownItem
              key={kind.type}
              testid={`scope-option-${kind.type}`}
              checked={current}
              className={count === 0 && !current ? 'opacity-45' : undefined}
              onClick={() => pick(kind.type)}
            >
              <DropdownGlyph>
                <kind.Glyph size={16} stroke={1.7} />
              </DropdownGlyph>
              <span className="min-w-0 flex-1 truncate">{t(kind.pluralLabel)}</span>
              <DropdownMeta testid={`scope-option-${kind.type}-count`}>{count}</DropdownMeta>
              <DropdownCheck on={current} />
            </DropdownItem>
          )
        })}
      </Dropdown>
    </div>
  )
}
