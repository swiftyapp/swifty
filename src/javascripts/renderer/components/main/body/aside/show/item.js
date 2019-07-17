import React from 'react'
import Copy from 'copy.svg'
import { clipboard } from 'electron'

export default ({ entry, name, link, secure }) => {
  const copy = value => {
    const notification = document.getElementsByClassName('copied-notification')[0]
    clipboard.writeText(value)
    notification.classList.remove('hidden')
    setTimeout(() => {
      notification.classList.add('hidden')
    }, 2000)
    setTimeout(() => {
      clipboard.clear()
    }, 60000)
  }

  const value = () => {
    if (link) {
      return <a href={entry[name.toLowerCase()]}>{entry[name.toLowerCase()]}</a>
    } else {
      return entry[name.toLowerCase()]
    }
  }

  const className = () => {
    return secure ? 'item secure' : 'item'
  }

  if (entry[name.toLowerCase()] === '') return null

  return (
    <div className={className()}>
      <div className="label">{name}</div>
      <div className="value">{value()}</div>
      <Copy width="16" height="16" onClick={() => copy(entry[name.toLowerCase()])} />
    </div>
  )
}
