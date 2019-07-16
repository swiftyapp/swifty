import React from 'react'

export default ({ name, entry, onChange, multiline }) => {

  const renderInput = () => {
    if (multiline) {
      return (
        <textarea
          name={name.toLowerCase()}
          cols="10"
          rows="5"
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
    <div className="field">
      <label htmlFor="">{name}</label>
      {renderInput()}
    </div>
  )
}
