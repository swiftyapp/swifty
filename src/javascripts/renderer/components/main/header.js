import React from "react"
import { useDispatch } from "react-redux"
import Search from 'search.svg'

export default () => {
  const dispatch = useDispatch()

  const filterItems = event => {
    dispatch({ type: 'SET_FILTER_QUERY', query: event.target.value })
  }

  return (
    <div className="header">
      <div className="search">
        <Search width="16" height="16" />
        <input type="text" placeholder="Search" onChange={filterItems}/>
      </div>
      <div className="logobar">
        Swifty
      </div>
    </div>
  )
}
