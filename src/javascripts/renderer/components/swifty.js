import React from 'react'
import Setup from './password/setup'
import Auth from './password/auth'
import Main from './main'
import { connect } from 'react-redux'

const Swifty = ({ flow }) => {
  switch (flow) {
    case 'setup':
      return <Setup />
      break
    case 'auth':
      return <Auth />
      break
    case 'main':
      return <Main />
      break
    default:
      return <Auth />
  }
}

const mapStateToProps = state => {
  return { flow: state.flow }
}

export default connect(mapStateToProps, null)(Swifty)
