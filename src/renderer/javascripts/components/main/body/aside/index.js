import React from 'react'
import Audit from './audit'
import Form from './form'
import Empty from './empty'
import Show from './show'
import { useSelector } from 'react-redux'

const View = () => {
  const { isNew, isEditing, entry, scope } = useSelector(state => ({
    scope: state.filters.scope,
    isNew: state.entries.new,
    isEditing: state.entries.edit,
    entry: state.entries.current
  }))

  if (isNew) return <Form />
  if (isEditing) return <Form entry={entry} />
  if (entry) return <Show entry={entry} />
  if (scope === 'audit') return <Audit />
  return <Empty />
}

export default View
