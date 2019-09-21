import React from 'react'
import Item from './item'
import Tags from './item/tags'

const Card = ({ entry }) => {
  return (
    <div className="entry-details">
      <Item name="Number" entry={entry} cc />
      <Item name="Year" entry={entry} />
      <Item name="Month" entry={entry} />
      <Item name="CVC" entry={entry} />
      <Item name="Pin" entry={entry} secure />
      <Item name="Name" entry={entry} />
      <Tags entry={entry} />
    </div>
  )
}

export default Card
