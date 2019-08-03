import React from 'react'
import generator from 'generate-password'

import Field from './field'
import SecureField from './secure'

const Login = ({ entry, validate, onChange }) => {
  const generatePassword = () => {
    const password = generator.generate({ length: 12, numbers: true })
    onChange({ target: { name: 'password', value: password } })
  }

  return (
    <>
      <Field
        name="Title"
        validate={validate}
        entry={entry}
        onChange={onChange}
      />
      <Field name="Website" entry={entry} onChange={onChange} />
      <Field
        name="Username"
        validate={validate}
        entry={entry}
        onChange={onChange}
      />
      <SecureField
        name="Password"
        validate={validate}
        entry={entry}
        onChange={onChange}
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
