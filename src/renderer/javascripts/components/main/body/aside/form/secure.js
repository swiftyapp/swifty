import React, { useState } from 'react'
import classnames from 'classnames'
import View from 'view.svg'
import Hide from 'hide.svg'

export default ({
  label,
  name,
  entry,
  validate,
  onChange,
  children,
  rows,
  maxLength
}) => {
  const [show, setShow] = useState(false)

  const toggleSecure = () => setShow(!show)

  const isEmpty = () => {
    return entry[name.toLowerCase()].trim() === ''
  }

  const value = () => {
    return entry[name.toLowerCase()]
  }

  const className = () => {
    return classnames('field', {
      'secure-on': !show,
      'secure-off': show,
      error: validate && isEmpty()
    })
  }

  const renderInput = () => {
    if (rows && rows !== '1') {
      return (
        <textarea
          name={name.toLowerCase()}
          cols="10"
          rows={rows}
          value={value()}
          onChange={onChange}
          maxLength={maxLength ? maxLength : ''}
        />
      )
    }
    return (
      <input
        name={name.toLowerCase()}
        type="text"
        value={value()}
        onChange={onChange}
        maxLength={maxLength ? maxLength : ''}
      />
    )
  }

  return (
    <div className={className()}>
      <label htmlFor="">{label}</label>
      <div className="value">
        <div className="wrapper">
          {renderInput()}
          <View
            width="16"
            height="16"
            onClick={toggleSecure}
            className="view"
          />
          <Hide
            width="16"
            height="16"
            onClick={toggleSecure}
            className="hide"
          />
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
