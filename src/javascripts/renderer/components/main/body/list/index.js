import shortid from 'shortid'
import React from 'react'
import Item from './item'
import { connect } from 'react-redux'

const List = ({ entries }) => {
  const emptyList = () => (
    <div className="empty">No Items</div>
  )

  const entriesList = () => {
    return entries.map(entry => (
      <Item entry={entry} key={shortid.generate()} />
    ))
  }

  if (entries.length == 0) return emptyList()

  return (
    <div className="list">
      {entriesList()}
    </div>
  )
}

const mapStateToProps = state => {
  return {
    entries: state.entries.items
  }
}
export default connect(mapStateToProps, null)(List)
