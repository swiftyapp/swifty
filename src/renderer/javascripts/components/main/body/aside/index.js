import React from 'react'
import Form from './form'
import Empty from './empty'
import Show from './show'

import { connect } from 'react-redux'

const View = ({ isNew, isEditing, entry }) => {
  if (isNew) return <Form />
  if (!entry) return <Empty />
  if (isEditing) return <Form entry={entry} />
  return <Show entry={entry} />
}

const mapStateToProps = state => {
  return {
    isNew: state.entries.new,
    isEditing: state.entries.edit,
    entry: state.entries.current
  }
}

export default connect(
  mapStateToProps,
  null
)(View)
