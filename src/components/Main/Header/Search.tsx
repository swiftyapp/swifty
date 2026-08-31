import { useStore, setFilterQuery } from '@/store'
import { t } from '@/i18n'
import { SearchGlyph } from '../icons'

// Command-bar style search entry: search glyph, input, and a mono ⌘K chip that
// swaps to a clear button once there's a query.
export default function Search() {
  const query = useStore(state => state.filters.query)

  return (
    <div className="flex-none [-webkit-app-region:no-drag]">
      <div className="flex h-[30px] w-[400px] items-center gap-2.5 rounded-lg border border-line2 bg-field pl-[11px] pr-2 text-text3 transition-colors focus-within:border-accent-line">
        <SearchGlyph className="flex-none" />
        <input
          type="search"
          name="search"
          placeholder={t('Search')}
          value={query}
          onChange={e => setFilterQuery(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-xs text-text outline-none placeholder:text-text3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query === '' ? (
          <span className="flex-none rounded-[5px] border border-line px-[5px] py-px font-mono text-[11px] text-text3">
            ⌘K
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            aria-label={t('Clear')}
            className="grid h-4 w-4 flex-none place-items-center rounded-full text-text3 hover:text-text"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
