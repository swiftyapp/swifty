import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import SearchIcon from 'search.svg'
import ClearIcon from 'clear.svg'

const Search = () => {
  const dispatch = useDispatch()
  const filterTerm = useSelector(state => state.filters.query)

  const filterItems = event => {
    dispatch({ type: 'SET_FILTER_QUERY', query: event.target.value })
  }

  const clearFilter = () => {
    dispatch({ type: 'SET_FILTER_QUERY', query: '' })
  }

  return (
    <div className="search">
      <SearchIcon width="16" height="16" className="search-icon" />
      <input
        type="search"
        name="search"
        placeholder="Search"
        value={filterTerm}
        onChange={filterItems}
      />
      {filterTerm !== '' && (
        <ClearIcon
          onClick={clearFilter}
          width="10"
          height="10"
          className="clear-icon"
        />
      )}
    </div>
  )
}

export default Search
