import React from 'react'
import Start from './start'
import Auth from './auth'
import Main from './main'
import { useSelector } from 'react-redux'

const Swifty = () => {
  const flow = useSelector(state => state.flow)

  switch (flow) {
    case 'setup':
      return <Start />
    case 'auth':
      return <Auth />
    case 'main':
      return <Main />
    default:
      return null
  }
}

export default Swifty
