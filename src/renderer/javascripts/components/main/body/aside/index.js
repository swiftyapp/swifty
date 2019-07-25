import React from 'react'
import Form from './form'
import Empty from './empty'
import Show from './show'
import { useSelector } from 'react-redux'

const View = () => {
  const { isNew, isEditing, entry } = useSelector(state => ({
    isNew: state.entries.new,
    isEditing: state.entries.edit,
    entry: state.entries.current
  }))

  if (isNew) return <Form />
  if (!entry) return <Empty />
  if (isEditing) return <Form entry={entry} />
  return <Show entry={entry} />
}

export default View
