import classnames from 'classnames'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Gear from 'gear.svg'

export default ({ entry }) => {
  const dispatch = useDispatch()
  const current = useSelector(state => state.entries.current)

  const onClick = () => {
    dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
  }

  const classname = () => {
    return classnames('entry', { current: current && current.id === entry.id })
  }

  return (
    <div className={classname()} onClick={onClick}>
      <div className="icon">
        <Gear width="32" height="32" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
        <div className="secondary">{entry.username}</div>
      </div>
    </div>
  )
}
