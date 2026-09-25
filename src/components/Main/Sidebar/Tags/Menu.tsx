import { useTranslation } from 'react-i18next'
import { useUi, showTag } from '@/store'
import { cx } from '@/utils/cx'
import { Dropdown, DropdownCheck, DropdownItem, DropdownMeta } from '@/components/elements/Dropdown'
import { useTagCounts } from './useTagCounts'
import { META } from '@/components/elements/tokens'

// Hangs off the right edge of the 36px rail tile, floating over the list column
// — the rail itself is too narrow to hold a menu. `className` is where it is
// pinned, which a caller that puts the tile elsewhere overrides.
export default function Menu({
  onClose,
  className
}: {
  onClose: () => void
  className?: string
}) {
  const { t } = useTranslation()
  // The tag the Tags view is showing, if that is the open view.
  const active = useUi(state => (state.view === 'tags' ? state.filterTag : null))
  const tags = useTagCounts()

  // Picking a tag is navigation: it opens the Tags view on that tag's items,
  // wherever the menu was opened from.
  const pick = (tag: string) => {
    showTag(tag)
    onClose()
  }

  return (
    <div className={cx('absolute z-20 w-[220px]', className ?? 'left-full top-0 ml-3')}>
      <Dropdown onBlur={onClose} className="w-full" listClassName="max-h-[320px]">
        {tags.length === 0 ? (
          <div className="px-2 py-1.5" data-testid="tags-empty">
            <div className="text-base text-text2">{t('No tags yet')}</div>
            <div className={`mt-1 ${META}`}>
              {t('Add tags to an entry and they show up here.')}
            </div>
          </div>
        ) : (
          tags.map(({ tag, count }) => (
            <DropdownItem
              key={tag}
              testid={`tag-option-${tag}`}
              checked={tag === active}
              onClick={() => pick(tag)}
            >
              <DropdownCheck on={tag === active} />
              <span className="min-w-0 flex-1 truncate">{tag}</span>
              <DropdownMeta testid={`tag-option-${tag}-count`}>{count}</DropdownMeta>
            </DropdownItem>
          ))
        )}
      </Dropdown>
    </div>
  )
}
