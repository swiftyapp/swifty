import classnames from 'classnames'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Login from './login'
import Card from './card'
import Note from './note'

export default ({ entry }) => {
  const dispatch = useDispatch()
  const current = useSelector(state => state.entries.current)

  const onClick = () => {
    dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
  }

  const classname = () => {
    return classnames('entry', { current: current && current.id === entry.id })
  }

  const itemContent = () => {
    switch (entry.type) {
      case 'login':
        return <Login entry={entry} />
      case 'card':
        return <Card entry={entry} />
      case 'note':
        return <Note entry={entry} />
      default:
        return null
    }
  }

  return (
    <div className={classname()} onClick={onClick}>
      {itemContent()}
    </div>
  )
}
