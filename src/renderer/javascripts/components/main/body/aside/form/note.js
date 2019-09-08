import React from 'react'
import Field from './field'
import SecureField from './secure'

const Note = ({ entry, validate, onChange }) => {
  return (
    <>
      <Field
        name="Title"
        entry={entry}
        onChange={onChange}
        validate={validate}
        maxLength="40"
      />
      <SecureField
        name="Note"
        entry={entry}
        onChange={onChange}
        validate={validate}
        rows="15"
      />
    </>
  )
}

export default Note
