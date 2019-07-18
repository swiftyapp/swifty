import React from 'react'
import { connect } from 'react-redux'

const Sidebar = ({ onAddEntry }) => {
  return (
    <div className="sidebar">
      <div className="add-button" onClick={onAddEntry}>
        +
      </div>
    </div>
  )
}

const mapDispatchToProps = dispatch => {
  return {
    onAddEntry: () => {
      dispatch({ type: 'NEW_ENTRY' })
    }
  }
}

export default connect(
  null,
  mapDispatchToProps
)(Sidebar)
