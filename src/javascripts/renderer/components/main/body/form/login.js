import React, { useState } from 'react'
import saveItem from 'actions/credentials'

export default () => {
  const [credentials, setCredentials] = useState({})

  const updateCredentials = event => {
    let obj = {}
    obj[event.target.name] = event.target.value
    setCredentials({ ...credentials, ...obj})
  }

  const saveCredentials = () => {
    if (credentials.title && credentials.username && credentials.password) {
      saveItem(credentials)
    } else {
      console.log("Please fill in title, username and password")
    }
  }

  return (
    <div className="aside">
      <div className="field">
        <label htmlFor="">Title</label>
        <input name="title" type="text" onChange={updateCredentials} />
      </div>
      <div className="field">
        <label htmlFor="">Website</label>
        <input name="website" type="text" onChange={updateCredentials} />
      </div>
      <div className="field">
        <label htmlFor="">Username</label>
        <input name="username" type="text" onChange={updateCredentials} />
      </div>
      <div className="field">
        <label htmlFor="">Password</label>
        <input name="password" type="text" onChange={updateCredentials} />
      </div>
      <div className="field">
        <label htmlFor="">Email</label>
        <input name="email" type="text" onChange={updateCredentials} />
      </div>
      <div className="field">
        <label htmlFor="">Note</label>
        <textarea name="note" cols="10" rows="5" onChange={updateCredentials} />
      </div>
      <div className="action">
        <span className="button" onClick={saveCredentials}>Save</span>
      </div>
    </div>
  )
}
