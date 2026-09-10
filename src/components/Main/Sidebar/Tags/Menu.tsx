import { useTranslation } from 'react-i18next'
import { useStore, showTag } from '@/store'
import { cx } from '@/utils/cx'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { CheckGlyph } from '../../icons'
import { useTagCounts } from './useTagCounts'

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
  const active = useStore(state => (state.ui.view === 'tags' ? state.filters.tag : null))
  const tags = useTagCounts()

  // Picking a tag is navigation: it opens the Tags view on that tag's items,
  // wherever the menu was opened from.
  const pick = (tag: string) => {
    showTag(tag)
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
