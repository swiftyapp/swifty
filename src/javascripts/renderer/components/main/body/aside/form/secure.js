import React, { useState } from 'react'
import classnames from 'classnames'
import View from 'view.svg'
import Hide from 'hide.svg'

export default ({ name, entry, onChange }) => {
  const [show, setShow] = useState(false)

  const toggleSecure = () => setShow(!show)

  const className = () => {
    return classnames('field', { 'secure-on': !show, 'secure-off': show })
  }

  return (
    <div className={className()}>
      <label htmlFor="">{name}</label>
      <input
        name={name.toLowerCase()}
        type="text"
        onChange={onChange}
        value={entry[name.toLowerCase()]}
      />
      <View width="16" height="16" onClick={toggleSecure} className="view" />
      <Hide width="16" height="16" onClick={toggleSecure} className="hide" />
    </div>
  )
}
