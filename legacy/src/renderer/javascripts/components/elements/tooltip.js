import React from 'react'
import classnames from 'classnames'

const Tooltip = ({ children, content, className }) => {
  return (
    <div className={classnames('tooltip-context', className)}>
      <div className="tooltip">{content}</div>
      {children}
    </div>
  )
}

export default Tooltip
