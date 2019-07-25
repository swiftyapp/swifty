import React, { useState } from 'react'
import generator from 'generate-password'
import { useDispatch } from 'react-redux'

import Field from './field'
import SecureField from './secure'

import { saveEntry } from 'actions/entries'

const Form = ({ entry }) => {
  const dispatch = useDispatch()
  const [credentials, setCredentials] = useState(
    entry || {
      title: '',
      type: 'login',
      website: '',
      username: '',
      password: '',
      email: '',
      note: ''
    }
  )
  const [validate, setValidate] = useState(false)

  const updateCredentials = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setCredentials({ ...credentials, ...obj })
  }

  const saveCredentials = () => {
    if (credentials.title && credentials.username && credentials.password) {
      dispatch(saveEntry(credentials))
    } else {
      setValidate(true)
    }
  }

  const reset = () => {
    if (entry) {
      dispatch({ type: 'SET_CURRENT_ENTRY', id: entry.id })
    } else {
      dispatch({ type: 'SET_NO_ENTRY' })
    }
  }

  const generatePassword = () => {
    const password = generator.generate({ length: 12, numbers: true })
    setCredentials({ ...credentials, password })
  }

  return (
    <div className="aside">
      <Field
        name="Title"
        validate={validate}
        entry={credentials}
        onChange={updateCredentials}
      />
      <Field name="Website" entry={credentials} onChange={updateCredentials} />
      <Field
        name="Username"
        validate={validate}
        entry={credentials}
        onChange={updateCredentials}
      />
      <SecureField
        name="Password"
        validate={validate}
        entry={credentials}
        onChange={updateCredentials}
      >
        <span className="action" onClick={generatePassword}>
          generate
        </span>
      </SecureField>
      <Field name="Email" entry={credentials} onChange={updateCredentials} />
      <Field
        name="Note"
        entry={credentials}
        onChange={updateCredentials}
        multiline
      />

      <div className="actions">
        <span className="cancel" onClick={reset}>
          Cancel
        </span>
        <span className="button" onClick={saveCredentials}>
          Save
        </span>
      </div>
    </div>
  )
}

export default Form
