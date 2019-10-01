import React from 'react'
import shortid from 'shortid'
import Item from '../item'

const Duplicates = ({ entries }) => {
  if (entries.length === 0) return null

  return (
    <div className="audit-group level-three">
      <div className="title">Duplicates</div>
      {entries.map(item => (
        <Item entry={item} key={shortid.generate()} />
      ))}
    </div>
  )
}

export default Duplicates
