import React from 'react'
import { useDispatch } from 'react-redux'

export default ({ entry }) => {
  const dispatch = useDispatch()

  const onClick = () => {
    dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
  }

  return (
    <div className="entry" onClick={onClick}>
      <div className="icon">
        <img src="images/gear.svg" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
        <div className="secondary">{entry.username}</div>
      </div>
    </div>
  )
}
