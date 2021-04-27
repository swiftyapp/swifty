import React from 'react'
import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Note = ({ entry, validate, onChange, onTagsChange }) => {
  const { i18n } = window
  return (
    <>
      <Field
        name={i18n('Title')}
        entry={entry}
        onChange={onChange}
        validate={validate}
        maxLength="40"
      />
      <SecureField
        name={i18n('Note')}
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
