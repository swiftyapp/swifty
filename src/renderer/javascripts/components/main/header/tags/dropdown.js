import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Dropdown, DropdownItem } from 'components/elements/dropdown'
import Empty from './empty'

export default ({ visible, setVisible }) => {
  if (!visible) return null

  const dispatch = useDispatch()
  const { tags } = useSelector(state => ({
    tags: Array.from(
      new Set(
        state.entries.items
          .filter(item => item.type === state.filters.scope)
          .map(entry => entry.tags)
          .flat()
          .filter(item => item !== undefined)
      )
    )
  }))

  const setTag = tag => {
    dispatch({ type: 'SET_FILTER_TAG', tag: tag })
    setVisible(false)
  }

  return (
    <Dropdown onBlur={() => setVisible(false)}>
      <Empty tags={tags} />
      {tags.map(tag => (
        <DropdownItem key={tag} onClick={() => setTag(tag)}>
          {tag}
        </DropdownItem>
      ))}
    </Dropdown>
  )
}
