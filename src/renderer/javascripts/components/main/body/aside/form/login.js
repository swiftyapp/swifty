import React from 'react'
import { getProps } from 'defaults/generator'

import Field from './field'
import SecureField from './secure'

const Login = ({ entry, validate, onChange }) => {
  const generatePassword = () => {
    const password = window.generatePassword(getProps())
    onChange({ target: { name: 'password', value: password } })
  }

  return (
    <>
      <Field
        name="Title"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <Field name="Website" entry={entry} onChange={onChange} />
      <Field
        name="Username"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="40"
      />
      <SecureField
        name="Password"
        validate={validate}
        entry={entry}
        onChange={onChange}
        maxLength="24"
      >
        <span className="action" onClick={generatePassword}>
          generate
        </span>
      </SecureField>
      <Field name="Email" entry={entry} onChange={onChange} />
      <Field name="Note" entry={entry} onChange={onChange} rows="5" />
    </>
  )
}

export default Login
