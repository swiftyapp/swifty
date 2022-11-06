import React from 'react'
import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Card = ({ entry, validate, onChange, onTagsChange }) => {
  const { i18n } = window
  return (
    <>
      <Field
        label={i18n('Title')}
        name="title"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <Field
        label={i18n('Number')}
        name="number"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="19"
      />
      <Field
        label={i18n('Month')}
        name="month"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="2"
      />
      <Field
        label={i18n('Year')}
        name="year"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="4"
      />
      <Field
        label={i18n('CVC')}
        name="cvc"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="4"
      />
      <SecureField
        label={i18n('Pin')}
        name="pin"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="6"
      />
      <Field
        label={i18n('Name')}
        name="name"
        entry={entry}
        onChange={onChange}
      />
      <TagField entry={entry} onChange={onTagsChange} />
    </>
  )
}

export default Card
