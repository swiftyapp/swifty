import React from 'react'
import { parseDomain } from 'parse-domain'
import icons from 'defaults/icons'

const Login = ({ entry }) => {
  const getIconKey = () => {
    try {
      const url = new URL(entry.website)
      return parseDomain(url.host).domain
    } catch (e) {
      return 'default'
    }
  }

  const icon = icons[getIconKey()] ? icons[getIconKey()] : icons['default']

  return (
    <>
      <div className="icon web" style={{ backgroundColor: icon.color }}>
        <icon.icon width="20" height="20" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
        <div className="secondary">{entry.username}</div>
      </div>
    </>
  )
}

export default Login
