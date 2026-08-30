import React from 'react'
import Item from './item'
import Tags from './item/tags'

const Note = ({ entry }) => {
  return (
    <div className="entry-details">
      <Item name="Note" entry={entry} secure />
      <Tags entry={entry} />
    </div>
  )
}
export default Note
