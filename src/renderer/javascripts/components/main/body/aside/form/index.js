import React, { useState } from 'react'
import generator from 'generate-password'
import { connect } from 'react-redux'

import Field from './field'
import SecureField from './secure'

import { saveEntry } from 'actions/entries'

const Form = ({ entry, onSaveItem, onClickCancel }) => {
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

  const updateCredentials = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setCredentials({ ...credentials, ...obj })
  }

  const saveCredentials = () => {
    if (credentials.title && credentials.username && credentials.password) {
      onSaveItem(credentials)
    } else {
      /* eslint-disable-next-line no-console */
      console.log('Please fill in title, username and password')
    }
  }

  const reset = () => {
    onClickCancel(entry.id)
  }

  const generatePassword = () => {
    const password = generator.generate({ length: 12, numbers: true })
    setCredentials({ ...credentials, password })
  }

  return (
    <div className="aside">
      <Field name="Title" entry={credentials} onChange={updateCredentials} />
      <Field name="Website" entry={credentials} onChange={updateCredentials} />
      <Field name="Username" entry={credentials} onChange={updateCredentials} />
      <SecureField
        name="Password"
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

const mapDispatchToProps = dispatch => {
  return {
    onSaveItem: credentials => dispatch(saveEntry(credentials)),
    onClickCancel: id => dispatch({ type: 'SET_CURRENT_ENTRY', id: id })
  }
}
export default connect(
  null,
  mapDispatchToProps
)(Form)
