import React from 'react'
import Start from './start'
import Auth from './auth'
import Main from './main'
import { connect } from 'react-redux'

const Swifty = ({ flow }) => {
  switch (flow) {
    case 'setup':
      return <Start />
    case 'auth':
      return <Auth />
    case 'main':
      return <Main />
    default:
      return <Auth />
  }
}

const mapStateToProps = state => {
  return { flow: state.flow }
}

export default connect(
  mapStateToProps,
  null
)(Swifty)
