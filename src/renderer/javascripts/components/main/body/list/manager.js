import shortid from 'shortid'
import React from 'react'
import Item from './item'
import Empty from './empty'
import { useSelector } from 'react-redux'

const ManagerList = () => {
  const { entries, query, scope, tags } = useSelector(state => ({
    tags: state.filters.tags,
    scope: state.filters.scope,
    query: state.filters.query,
    entries: state.entries.items
  }))

  const entriesList = () => {
    let items = entries.filter(entry => entry.type === scope)

    if (query !== '') {
      items = items.filter(entry => {
        return (
          entry.type === scope &&
          entry.title.toLowerCase().match(query.toLowerCase())
        )
      })
    }

    if (tags.length !== 0) {
      items = items.filter(entry => {
        if (!entry.tags) return false
        return entry.tags.some(tag => tags.includes(tag))
      })
    }

    return items.map(entry => <Item entry={entry} key={shortid.generate()} />)
  }

  if (entriesList().length == 0) return <Empty />

  return <div className="list">{entriesList()}</div>
}

export default ManagerList
