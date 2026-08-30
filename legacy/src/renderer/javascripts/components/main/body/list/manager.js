import shortid from 'shortid'
import React from 'react'
import Item from './item'
import Empty from './empty'
import { useSelector } from 'react-redux'
import { filterEntries } from 'services/entries'

const ManagerList = () => {
  const { entries, query, scope, tags } = useSelector(state => ({
    tags: state.filters.tags,
    scope: state.filters.scope,
    query: state.filters.query,
    entries: state.entries.items
  }))

  const items = filterEntries(entries, { scope, query, tags })

  if (items.length == 0) return <Empty />

  return (
    <div className="list">
      {items.map(entry => (
        <Item entry={entry} key={shortid.generate()} />
      ))}
    </div>
  )
}

export default ManagerList
