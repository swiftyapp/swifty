import React from 'react'
import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Note = ({ entry, validate, onChange, onTagsChange }) => {
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
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}

export default Note
