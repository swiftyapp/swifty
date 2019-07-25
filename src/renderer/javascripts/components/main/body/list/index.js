import shortid from 'shortid'
import React from 'react'
import Item from './item'
import { useSelector } from 'react-redux'

const List = () => {
  const { entries, query } = useSelector(state => ({
    query: state.filters.query,
    entries: state.entries.items
  }))

  const emptyList = () => (
    <div className="list">
      <div className="empty">No Items</div>
    </div>
  )

  const entriesList = () => {
    let items
    if (query !== '') {
      items = entries.filter(entry => {
        return entry.title.toLowerCase().match(query.toLowerCase())
      })
    } else {
      items = entries
    }
    return items.map(entry => <Item entry={entry} key={shortid.generate()} />)
  }

  if (entries.length == 0) return emptyList()

  return <div className="list">{entriesList()}</div>
}

export default List
