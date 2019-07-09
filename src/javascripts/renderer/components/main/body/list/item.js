import React from 'react'
import { useDispatch } from 'react-redux'

export default ({ entry }) => {
  const dispatch = useDispatch()
  const attributes = Object.values(entry)[0]

  const onClick = () => {
    const id = Object.keys(entry)[0]
    dispatch({ type: 'SET_CURRENT_ENTRY', id: id })
  }

  return (
    <div className="entry" onClick={onClick}>
      <div className="icon">
        <img src="images/gear.svg" />
      </div>
      <div className="description">
        <div className="primary">{attributes.title}</div>
        <div className="secondary">{attributes.username}</div>
      </div>
    </div>
  )
}
