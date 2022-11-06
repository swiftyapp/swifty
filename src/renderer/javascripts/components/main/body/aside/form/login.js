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
        label={i18n('Title')}
        name="title"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <Field
        label={i18n('Website')}
        name="website"
        entry={entry}
        onChange={onChange}
      />
      <Field
        label={i18n('Username')}
        name="username"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <SecureField
        label={i18n('Password')}
        name="password"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="100"
      >
        <span className="action" onClick={generatePassword}>
          generate
        </span>
      </SecureField>
      <SecureField
        label={i18n('OTP')}
        name="otp"
        entry={entry}
        onChange={onChange}
      />
      <Field
        label={i18n('Email')}
        name="email"
        entry={entry}
        onChange={onChange}
      />
      <TagField entry={entry} onChange={onTagsChange} />
      <Field
        label={i18n('Note')}
        name="note"
        entry={entry}
        onChange={onChange}
        rows="5"
      />
    </>
  )
}

export default Login
