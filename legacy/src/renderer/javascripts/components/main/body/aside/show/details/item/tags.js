import React from 'react'
import shortid from 'shortid'

export default ({ entry }) => {
  const { i18n } = window
  if (!entry.tags || entry.tags.length === 0) return null

  const value = () => {
    return entry.tags.map(tag => (
      <span className="tag" key={shortid.generate()}>
        {tag}
      </span>
    ))
  }

  return (
    <div className="item">
      <div className="label">{i18n('Tags')}</div>
      <div className="value">{value()}</div>
    </div>
  )
}
