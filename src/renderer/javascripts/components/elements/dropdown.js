import React from 'react'
import classnames from 'classnames'

const Dropdown = ({ children, onBlur }) => {
  return (
    <>
      <div className="dropdown">{children}</div>
      <div className="dropdown-overlay" onClick={onBlur} />
    </>
  )
}

const DropdownItem = ({ id, separated, onClick, children }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={classnames('dropdown-item', {
        separated: separated
      })}
    >
      {children}
    </div>
  )
}

export { Dropdown, DropdownItem }
