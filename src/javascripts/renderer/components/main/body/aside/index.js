import React from 'react'
import Form from './form'
import Empty from './empty'
import Show from './show'

import { connect } from 'react-redux'

const View = ({ isNew, entry }) => {
  if (isNew) return <Form />
  if (!entry) return <Empty />

  return <Show entry={entry} />
}

const mapStateToProps = state => {
  return {
    isNew: state.entries.new,
    entry: state.entries.current
  }
}

export default connect(mapStateToProps, null)(View)
