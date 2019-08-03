import React from 'react'
import Key from 'logins/key.svg'

const Login = ({ entry }) => {
  return (
    <>
      <div className="icon">
        <Key width="32" height="32" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
        <div className="secondary">{entry.username}</div>
      </div>
    </>
  )
}

export default Login
