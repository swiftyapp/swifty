import React from 'react'
import Visa from 'cards/visa.svg'
import Master from 'cards/master.svg'
import CardIcon from 'cards/card.svg'

const Card = ({ entry }) => {
  const icon = () => {
    switch (entry.number[0]) {
      case '5':
        return <Master width="32" />
      case '4':
        return <Visa width="32" />
      default:
        return <CardIcon width="32" />
    }
  }
  return (
    <>
      <div className="icon">{icon()}</div>
      <div className="description">
        <div className="primary">{entry.title}</div>
      </div>
    </>
  )
}

export default Card
