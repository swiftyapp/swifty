import React from 'react'
import Setup from './password/setup'
import Auth from './password/auth'
import Main from './main'

export default ({ flow }) => {
  switch (flow) {
    case 'setup':
      return <Setup />
      break
    case 'auth':
      return <Auth />
      break
    default:
      return <Main />
  }
}
