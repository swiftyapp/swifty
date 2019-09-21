import React from 'react'
import shortid from 'shortid'

export default ({ entry }) => {
  if (!entry.tags) return null

  const value = () => {
    return entry.tags.map(tag => (
      <span className="tag" key={shortid.generate()}>
        {tag}
      </span>
    ))
  }

  return (
    <div className="item">
      <div className="label">Tags</div>
      <div className="value">{value()}</div>
    </div>
  )
}
