import React from 'react'
import Sidebar from './sidebar'
import Header from './header'
import Body from './body'

export const Main = () => {
  return (
    <div className="layout">
      <Sidebar />
      <div className="mainbar">
        <Header />
        <Body />
      </div>
    </div>
  )
}
