import React from 'react'
import shortid from 'shortid'
import Item from '../item'

const Short = ({ entries }) => {
  if (entries.length === 0) return null

  return (
    <>
      <div className="audit-group level-two">Short</div>
      {entries.map(item => (
        <Item entry={item} key={shortid.generate()} />
      ))}
    </>
  )
}

export default Short
