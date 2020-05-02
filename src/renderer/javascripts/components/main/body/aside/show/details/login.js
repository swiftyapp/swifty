import React from 'react'
import Item from './item'
import Totp from './item/totp'
import Tags from './item/tags'

const Login = ({ entry }) => {
  return (
    <div className="entry-details">
      <Item name="Website" entry={entry} link />
      <Item name="Username" entry={entry} />
      <Item name="Password" entry={entry} secure />
      <Totp name="OTP" entry={entry} />
      <Item name="Email" entry={entry} />
      <Tags entry={entry} />
      <Item name="Note" entry={entry} />
    </div>
  )
}

export default Login
