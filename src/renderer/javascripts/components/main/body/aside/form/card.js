import React from 'react'
import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Card = ({ entry, validate, onChange, onTagsChange }) => {
  const { i18n } = window
  return (
    <>
      <Field
        name={i18n('Title')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <Field
        name={i18n('Number')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="19"
      />
      <Field
        name={i18n('Month')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="2"
      />
      <Field
        name={i18n('Year')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="4"
      />
      <Field
        name={i18n('CVC')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="4"
      />
      <SecureField
        name={i18n('Pin')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="6"
      />
      <Field name={i18n('Name')} entry={entry} onChange={onChange} />
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}

export default Card
