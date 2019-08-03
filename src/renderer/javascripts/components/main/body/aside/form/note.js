import React from 'react'
import Field from './field'

const Note = ({ entry, validate, onChange }) => {
  return (
    <>
      <Field
        name="Title"
        entry={entry}
        onChange={onChange}
        validate={validate}
      />
      <Field
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
