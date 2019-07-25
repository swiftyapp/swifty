import React from 'react'
import { useDispatch } from 'react-redux'

const Sidebar = () => {
  const dispatch = useDispatch()

  const onAddEntry = () => dispatch({ type: 'NEW_ENTRY' })

  return (
    <div className="sidebar">
      <div className="add-button" onClick={onAddEntry}>
        +
      </div>
    </div>
  )
}
export default Sidebar
