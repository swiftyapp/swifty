import React from 'react'
import { useDispatch } from 'react-redux'

const Add = () => {
  const dispatch = useDispatch()

  const onAddEntry = () => dispatch({ type: 'NEW_ENTRY' })

  return (
    <div className="add-button" onClick={onAddEntry}>
      +
    </div>
  )
}

export default Add
