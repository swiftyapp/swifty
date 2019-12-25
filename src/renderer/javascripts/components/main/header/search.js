import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import SearchIcon from 'search.svg'

const Search = () => {
  const dispatch = useDispatch()
  const filterTerm = useSelector(state => state.filters.query)

  const filterItems = event => {
    dispatch({ type: 'SET_FILTER_QUERY', query: event.target.value })
  }

  return (
    <div className="search">
      <SearchIcon width="16" height="16" className="search-icon" />
      <input
        type="text"
        placeholder="Search"
        value={filterTerm}
        onChange={filterItems}
      />
    </div>
  )
}

export default Search
