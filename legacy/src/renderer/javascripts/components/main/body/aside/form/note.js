import React from 'react'
import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Note = ({ entry, validate, onChange, onTagsChange }) => {
  const { i18n } = window
  return (
    <>
      <Field
        label={i18n('Title')}
        name="title"
        entry={entry}
        onChange={onChange}
        validate={validate}
        maxLength="40"
      />
      <SecureField
        label={i18n('Note')}
        name="note"
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
