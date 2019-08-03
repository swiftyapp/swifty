import React from 'react'
import Item from './item'

const Login = ({ entry }) => {
  return (
    <div className="entry-details">
      <Item name="Website" entry={entry} link />
      <Item name="Username" entry={entry} />
      <Item name="Password" entry={entry} secure />
      <Item name="Email" entry={entry} />
      <Item name="Note" entry={entry} />
    </div>
  )
}

export default Login
