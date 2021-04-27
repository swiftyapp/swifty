import React from 'react'
import { getProps } from 'defaults/generator'

import Field from './field'
import SecureField from './secure'
import TagField from './tag'

const Login = ({ entry, validate, onChange, onTagsChange }) => {
  const { i18n } = window
  const generatePassword = () => {
    const password = window.GeneratorAPI.generatePassword(getProps())
    onChange({ target: { name: 'password', value: password } })
  }

  return (
    <>
      <Field
        name={i18n('Title')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <Field name={i18n('Website')} entry={entry} onChange={onChange} />
      <Field
        name={i18n('Username')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <SecureField
        name={i18n('Password')}
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="100"
      >
        <span className="action" onClick={generatePassword}>
          generate
        </span>
      </SecureField>
      <SecureField name={i18n('OTP')} entry={entry} onChange={onChange} />
      <Field name={i18n('Email')} entry={entry} onChange={onChange} />
      <TagField entry={entry} onChange={onTagsChange} />
      <Field name={i18n('Note')} entry={entry} onChange={onChange} rows="5" />
    </>
  )
}

export default Login
