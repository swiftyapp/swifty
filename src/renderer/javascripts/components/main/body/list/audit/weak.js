import React from 'react'
import shortid from 'shortid'
import Item from '../item'

const Weak = ({ entries }) => {
  if (entries.length === 0) return null

  return (
    <>
      <div className="audit-group level-one">Weak</div>
      {entries.map(item => (
        <Item entry={item} key={shortid.generate()} />
      ))}
    </>
  )
}

export default Weak
