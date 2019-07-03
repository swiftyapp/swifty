import React from 'react'
import Setup from './password/setup'
import Enter from './password/enter'
import Main from './main'

export default ({ flow }) => {
  switch (flow) {
    case 'setup':
      return <Setup />
      break
    case 'auth':
      return <Enter />
      break
    default:
      return <Main />
  }
}
