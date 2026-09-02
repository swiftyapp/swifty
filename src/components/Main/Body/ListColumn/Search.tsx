import type { KeyboardEvent } from 'react'
import { useStore, setFilterQuery, setCurrentEntry } from '@/store'
import { copySecret } from '@/services/entries'
import { t } from '@/i18n'
import { useVisibleEntries } from '../List/useVisibleEntries'
import { CloseGlyph, SearchGlyph } from '../../icons'
import { registerSearch } from './focus'

// The app's one search field: it sits in the list column it filters, spans the
// column, and carries the two palette accelerators — ⏎ selects the first
// visible row, ⌘⏎ copies its primary secret. Esc clears the query, then blurs.
export default function Search() {
  const query = useStore(state => state.filters.query)
  const [first] = useVisibleEntries()

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query === '') e.currentTarget.blur()
      else setFilterQuery('')
      return
    }
    if (e.key !== 'Enter' || !first) return
    if (e.metaKey || e.ctrlKey) void copySecret(first)
    else setCurrentEntry(first.id)
  }

  return (
    <div className="mt-3 flex h-7 items-center gap-2.5 rounded-sm border border-line2 bg-field pl-[11px] pr-2 text-text3 transition-colors focus-within:border-accent-line">
      <SearchGlyph className="flex-none" />
      <input
        ref={registerSearch}
        type="search"
        name="search"
        data-testid="search-input"
        placeholder={t('Search')}
        value={query}
        onChange={e => setFilterQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-text outline-none placeholder:text-text3 [&::-webkit-search-cancel-button]:hidden"
      />
      {query !== '' && (
        <button
          type="button"
          onClick={() => setFilterQuery('')}
          aria-label={t('Clear')}
          data-testid="search-clear-button"
          className="grid h-4 w-4 flex-none place-items-center rounded-full text-text3 hover:text-text"
        >
          <CloseGlyph size={12} />
        </button>
      )}
    </div>
  )
}
