import { useTranslation } from 'react-i18next'
import { useUi, useVault, setFilterType, showKind } from '@/store'
import { KINDS } from '@/kinds'
import { cx } from '@/utils/cx'
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownMeta,
  DropdownSeparator
} from '@/components/elements/Dropdown'
import { CheckGlyph, GridRailGlyph } from '../../icons'
import { useKindCounts } from './useKindCounts'

interface Props {
  onClose: () => void
  /** Where the panel hangs; under the title's left edge by default. */
  className?: string
}

// The places under All Items: the whole vault, then under a "Kinds" caption
// one row per kind with its glyph and count — every kind the app has, so the
// menu is also where a new user learns what the vault can hold. A kind with
// nothing in it is dimmed but stays a place: picking it lands on the kind's
// empty state and its add action. The open place is checked at the row's end.
export default function ScopeMenu({ onClose, className }: Props) {
  const { t } = useTranslation()
  const open = useUi(state => state.filterType)
  const total = useVault(state => state.items.length)
  const counts = useKindCounts()

  const pick = (action: () => void) => {
    action()
    onClose()
  }

  // The check holds its place on every row, so the counts line up in a column
  // whether or not a row is the chosen one.
  const check = (on: boolean) => (
    <span className={cx('flex-none', !on && 'opacity-0')} aria-hidden={!on}>
      <CheckGlyph stroke={2} />
    </span>
  )

  return (
    <div className={cx('absolute z-20 w-[256px]', className ?? 'left-0 top-full mt-1.5')}>
      <Dropdown onBlur={onClose} className="w-full" listClassName="max-h-[360px]">
        <DropdownItem
          testid="scope-option-all"
          checked={open === null}
          onClick={() => pick(() => setFilterType(null))}
        >
          <span className="flex-none opacity-85">
            <GridRailGlyph size={16} stroke={1.7} />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{t('All Items')}</span>
          <DropdownMeta testid="scope-option-all-count">{total}</DropdownMeta>
          {check(open === null)}
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
              dim={count === 0 && !current}
              onClick={() => pick(() => showKind(kind.type))}
            >
              <span className="flex-none opacity-85">
                <kind.Glyph size={16} stroke={1.7} />
              </span>
              <span className="min-w-0 flex-1 truncate">{t(kind.pluralLabel)}</span>
              <DropdownMeta testid={`scope-option-${kind.type}-count`}>{count}</DropdownMeta>
              {check(current)}
            </DropdownItem>
          )
        })}
      </Dropdown>
    </div>
  )
}
