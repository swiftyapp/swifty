import React from 'react'
import Add from './add'
import Switcher from './switcher'
import Settings from './settings'

const Sidebar = () => {
  return (
    <div className="sidebar">
      <Add />
      <Switcher />
      <Settings />
    </div>
  )
}
export default Sidebar
