import React from 'react'
import Copy from 'copy.svg'
import { copy } from 'services/copy'

export default ({ entry, name, link, cc, secure }) => {
  const onClick = event => {
    window.AppAPI.openLink(event.target.href)
  }

  const value = () => {
    if (link) {
      return (
        <a href={entry[name.toLowerCase()]} onClick={onClick}>
          {entry[name.toLowerCase()]}
        </a>
      )
    } else if (cc) {
      return entry[name.toLowerCase()].match(/.{1,4}/g).join(' ')
    } else if (secure) {
      return window.CryptorAPI.decrypt(entry[name.toLowerCase()])
    } else {
      return entry[name.toLowerCase()]
    }
  }

  const copyValue = () => {
    if (secure) return window.CryptorAPI.decrypt(entry[name.toLowerCase()])
    return entry[name.toLowerCase()]
  }

  const className = () => {
    return secure ? 'item secure' : 'item'
  }

  if (entry[name.toLowerCase()] === '') return null

  return (
    <div className={className()}>
      <div className="label">{name}</div>
      <div className="value">{value()}</div>
      <Copy width="16" height="16" onClick={() => copy(copyValue())} />
    </div>
  )
}
