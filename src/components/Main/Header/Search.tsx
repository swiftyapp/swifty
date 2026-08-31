import { useStore, setFilterQuery, openPalette } from '@/store'
import { t } from '@/i18n'
import Kbd from '@/components/elements/Kbd'
import { CloseGlyph, SearchGlyph } from '../icons'

// Command-bar style search entry: search glyph, input, and a mono ⌘K chip that
// swaps to a clear button once there's a query. Typing filters the list in
// place; the ⌘K chip (or the shortcut) opens the command palette.
export default function Search() {
  const query = useStore(state => state.filters.query)

  return (
    <div className="flex-none">
      <div className="flex h-7 w-[400px] items-center gap-2.5 rounded-sm border border-line2 bg-field pl-[11px] pr-2 text-text3 transition-colors focus-within:border-accent-line">
        <SearchGlyph className="flex-none" />
        <input
          type="search"
          name="search"
          placeholder={t('Search')}
          value={query}
          onChange={e => setFilterQuery(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-text outline-none placeholder:text-text3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query === '' ? (
          <button
            type="button"
            onClick={() => openPalette()}
            title={t('Open command palette')}
            className="flex-none cursor-pointer transition-opacity hover:opacity-70"
          >
            <Kbd>⌘K</Kbd>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            aria-label={t('Clear')}
            className="grid h-4 w-4 flex-none place-items-center rounded-full text-text3 hover:text-text"
          >
            <CloseGlyph size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
