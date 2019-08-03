import shortid from 'shortid'
import React, { useEffect } from 'react'
import Item from './item'
import { useSelector } from 'react-redux'

const List = () => {
  const { entries, query, scope } = useSelector(state => ({
    scope: state.filters.scope,
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
        return entry.type === scope && entry.title.toLowerCase().match(query.toLowerCase())
      })
    } else {
      items = entries.filter(entry => {
        return entry.type === scope
      })
    }
    return items.map(entry => <Item entry={entry} key={shortid.generate()} />)
  }

  if (entriesList().length == 0) return emptyList()

  return <div className="list">{entriesList()}</div>
}

export default List
