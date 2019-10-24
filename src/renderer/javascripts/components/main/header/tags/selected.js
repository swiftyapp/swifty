import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

export default () => {
  const dispatch = useDispatch()
  const tag = useSelector(state => state.filters.tags[0])

  const unsetTag = () => {
    dispatch({ type: 'UNSET_FILTER_TAG' })
  }
  if (!tag) return null

  return (
    <span className="tag-selected">
      {tag}
      <span className="tag-clear" onClick={unsetTag}>
        x
      </span>
    </span>
  )
}
