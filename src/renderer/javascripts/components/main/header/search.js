import React from 'react'
import { useDispatch } from 'react-redux'
import SearchIcon from 'search.svg'

const Search = () => {
  const dispatch = useDispatch()

  const filterItems = event => {
    dispatch({ type: 'SET_FILTER_QUERY', query: event.target.value })
  }

  return (
    <div className="search">
      <SearchIcon width="16" height="16" className="search-icon" />
      <input type="text" placeholder="Search" onChange={filterItems} />
    </div>
  )
}

export default Search
