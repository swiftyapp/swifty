import type { KeyboardEvent } from 'react'
import { useStore, setFilterQuery } from '@/store'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import Kbd from '@/components/elements/Kbd'
import { CloseGlyph, SearchGlyph } from '../../icons'

// The desktop field's measure: 32px under a mouse. The compact root sends the
// 44px touch one in its place (`Compact/Vault`). Size only — the surface, its
// states and their motion below are the same field at either size.
const DESKTOP = 'mt-3 h-8 gap-2.5 rounded-sm pl-3 pr-1.5'

// The app's one search field: it sits in the list column it filters and spans
// the column. Esc clears the query, then blurs — the accelerators that act on
// the rows (↑/↓, ⏎, ⌘⏎) belong to the whole column, so they live one level up
// in useListKeys and reach this field by bubbling.
// `className` is the box's measure (height, radius, padding), not a layout
// flag: the field is 32px where a mouse points at it and the compact root swaps
// in the 44px touch one.
export default function Search({ className = DESKTOP }: { className?: string }) {
  const { t } = useTranslation()
  const query = useStore(state => state.filters.query)
  const empty = query === ''

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return
    if (empty) e.currentTarget.blur()
    else setFilterQuery('')
  }

  return (
    <div
      className={cx(
        'group relative flex items-center border bg-tile text-text3',
        // A flat tinted well with no edge of its own: at rest it reads as a
        // quiet shape in the ground, not a boxed control. Under the pointer the
        // tint deepens a step (ink at a low alpha, so it holds on both themes).
        // Holding the caret it switches on — the tint gives way to the detail
        // surface, a crisp accent stroke draws the edge and a wide, soft halo
        // of the same accent lifts it off the column. Hover stands down while
        // focused so the lit surface never flickers under the pointer.
        'border-transparent [&:hover:not(:focus-within)]:bg-text/10',
        'focus-within:border-accent-line focus-within:bg-detail focus-within:ring-3 focus-within:ring-accent-soft',
        // The slow tier: a field switching on should be seen doing it.
        'transition-[border-color,background-color,box-shadow] duration-300',
        className
      )}
    >
      {/* The glyph is the field's mood: muted at rest, ink under the pointer,
          accent while the field is listening. */}
      <SearchGlyph className="flex-none transition-colors duration-300 group-hover:text-text2 group-focus-within:text-accent" />
      <input
        type="search"
        name="search"
        data-testid="search-input"
        placeholder={t('Search')}
        value={query}
        onChange={e => setFilterQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-text caret-accent outline-none placeholder:text-text3 [&::-webkit-search-cancel-button]:hidden"
      />
      {/* One trailing slot, both occupants stacked in its single cell so the
          hint and the clear button crossfade in place: nothing to the left of
          them moves when a query arrives or goes. */}
      <span className="grid flex-none place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
        {/* The shortcut that lands here, shown while the field is idle and
            empty; focus fades it and eases it a step to the right, as if the
            caret's arrival nudged it out. A finger has no ⌘, so no coarse
            pointer ever sees it — the slot then shrinks to the clear button. */}
        <span
          aria-hidden
          className={cx(
            'transition-[opacity,transform] duration-300 any-pointer-coarse:hidden group-focus-within:translate-x-1 group-focus-within:opacity-0',
            !empty && 'translate-x-1 opacity-0'
          )}
        >
          <Kbd>⌘F</Kbd>
        </span>
        {/* Always mounted so it can ease in: a query fades and grows it from
            a dot to a button, clearing does the reverse. Out of reach and out
            of the tab order while there is nothing to clear. */}
        <button
          type="button"
          onClick={() => setFilterQuery('')}
          aria-label={t('Clear')}
          aria-hidden={empty}
          tabIndex={empty ? -1 : 0}
          data-testid="search-clear-button"
          className={cx(
            'grid h-5 w-5 cursor-pointer place-items-center rounded-full text-text3 transition-[opacity,transform,color,background-color] hover:bg-hover hover:text-text',
            empty ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          <CloseGlyph size={12} />
        </button>
      </span>
    </div>
  )
}
