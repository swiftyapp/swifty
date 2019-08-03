import React from 'react'
import classnames from 'classnames'

export default ({ name, entry, validate, onChange, rows }) => {
  const isEmpty = () => {
    return entry[name.toLowerCase()].trim() === ''
  }

  const classNames = () => {
    return classnames('field', { error: validate && isEmpty() })
  }

  const renderInput = () => {
    if (rows && rows !== '1') {
      return (
        <textarea
          name={name.toLowerCase()}
          cols="10"
          rows={rows}
          onChange={onChange}
          value={entry[name.toLowerCase()]}
        />
      )
    }
    return (
      <input
        name={name.toLowerCase()}
        type="text"
        onChange={onChange}
        value={entry[name.toLowerCase()]}
      />
    )
  }

  return (
    <div className={classNames()}>
      <label htmlFor="">{name}</label>
      {renderInput()}
    </div>
  )
}
