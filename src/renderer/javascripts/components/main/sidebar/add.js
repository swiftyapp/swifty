import React from 'react'
import { useDispatch } from 'react-redux'
import Plus from 'plus.svg'

const Add = () => {
  const dispatch = useDispatch()

  const onAddEntry = () => dispatch({ type: 'NEW_ENTRY' })

  return (
    <div className="add-button" onClick={onAddEntry}>
      <Plus />
    </div>
  )
}

export default Add
