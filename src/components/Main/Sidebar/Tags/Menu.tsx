import { useTranslation } from 'react-i18next'
import { useStore, setFilterTag } from '@/store'
import { cx } from '@/utils/cx'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { CheckGlyph } from '../../icons'
import { useTagCounts } from './useTagCounts'

// Hangs off the right edge of the 36px rail tile, floating over the list column
// — the rail itself is too narrow to hold a menu. `className` is where it is
// pinned, which the compact header changes.
export default function Menu({
  onClose,
  className
}: {
  onClose: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const active = useStore(state => state.filters.tag)
  const tags = useTagCounts()

  // A second pick on the active tag is how the filter is cleared, so the row
  // that turned it on also turns it off.
  const pick = (tag: string) => {
    setFilterTag(tag === active ? null : tag)
    onClose()
  }

  return (
    <div className={cx('absolute z-20 w-[220px]', className ?? 'left-full top-0 ml-3')}>
      <Dropdown onBlur={onClose} className="w-full">
        {tags.length === 0 ? (
          <div className="px-3.5 py-2.5" data-testid="tags-empty">
            <div className="text-base text-text2">{t('No tags yet')}</div>
            <div className="mt-1 text-xs text-text3">
              {t('Add tags to an entry and they show up here.')}
            </div>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {tags.map(({ tag, count }) => (
              <DropdownItem key={tag} testid={`tag-option-${tag}`} onClick={() => pick(tag)}>
                <span className="grid w-3.5 flex-none place-items-center text-accent">
                  {tag === active && <CheckGlyph />}
                </span>
                <span className="min-w-0 flex-1 truncate">{tag}</span>
                <span
                  data-testid={`tag-option-${tag}-count`}
                  className="flex-none font-mono text-xs opacity-60"
                >
                  {count}
                </span>
              </DropdownItem>
            ))}
          </div>
        )}
      </Dropdown>
    </div>
  )
}
