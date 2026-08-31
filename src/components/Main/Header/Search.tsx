import { useStore, setFilterQuery } from '@/store'
import { t } from '@/i18n'
import SearchIcon from '@/assets/images/search.svg?react'
import ClearIcon from '@/assets/images/clear.svg?react'

export default function Search() {
  const query = useStore(state => state.filters.query)

  return (
    <div className="search">
      <SearchIcon width="16" height="16" className="search-icon" />
      <input
        type="search"
        name="search"
        placeholder={t('Search')}
        value={query}
        onChange={e => setFilterQuery(e.target.value)}
      />
      {query !== '' && (
        <ClearIcon
          onClick={() => setFilterQuery('')}
          width="10"
          height="10"
          className="clear-icon"
        />
      )}
    </div>
  )
}
