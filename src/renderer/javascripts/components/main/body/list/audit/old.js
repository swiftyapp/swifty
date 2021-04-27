import React from 'react'
import shortid from 'shortid'
import Item from '../item'

const Old = ({ entries }) => {
  const { i18n } = window
  if (entries.length === 0) return null

  return (
    <div className="audit-group level-four">
      <div className="title">{i18n('Old')}</div>
      {entries.map(item => (
        <Item entry={item} key={shortid.generate()} />
      ))}
    </div>
  )
}

export default Old
