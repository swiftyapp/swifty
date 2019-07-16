import React, { useState } from 'react'
import { connect } from 'react-redux'

import { saveEntry } from 'actions/entries'

const Form = ({ entry, onSaveItem }) => {
  const [credentials, setCredentials] = useState(entry || {
    title: '',
    type: 'login',
    website: '',
    username: '',
    password: '',
    email: '',
    note: ''
  })

  const updateCredentials = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setCredentials({ ...credentials, ...obj})
  }

  const saveCredentials = () => {
    if (credentials.title && credentials.username && credentials.password) {
      onSaveItem(credentials)
    } else {
      console.log("Please fill in title, username and password")
    }
  }

  return (
    <div className="aside">
      <div className="field">
        <label htmlFor="">Title</label>
        <input name="title" type="text" onChange={updateCredentials} value={credentials.title} />
      </div>
      <div className="field">
        <label htmlFor="">Website</label>
        <input name="website" type="text" onChange={updateCredentials} value={credentials.website} />
      </div>
      <div className="field">
        <label htmlFor="">Username</label>
        <input name="username" type="text" onChange={updateCredentials} value={credentials.username} />
      </div>
      <div className="field">
        <label htmlFor="">Password</label>
        <input name="password" className="secure" type="text" onChange={updateCredentials} value={credentials.password} />
      </div>
      <div className="field">
        <label htmlFor="">Email</label>
        <input name="email" type="text" onChange={updateCredentials} value={credentials.email} />
      </div>
      <div className="field">
        <label htmlFor="">Note</label>
        <textarea name="note" cols="10" rows="5" onChange={updateCredentials} value={credentials.note} />
      </div>
      <div className="action">
        <span className="button" onClick={saveCredentials}>Save</span>
      </div>
    </div>
  )
}
const mapDispatchToProps = dispatch => {
  return {
    onSaveItem: credentials => dispatch(saveEntry(credentials))
  }
}
export default connect(null, mapDispatchToProps)(Form)
